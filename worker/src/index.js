/**
 * Tea & Coffee Brewing Water Advisor — backend worker.
 *
 * Required secrets (set with `wrangler secret put <NAME>`):
 *   STRIPE_SECRET_KEY        - Stripe secret key (sk_live_... or sk_test_...)
 *   STRIPE_WEBHOOK_SECRET    - Stripe webhook signing secret (whsec_...)
 *   ADMIN_PASSWORD           - password for the /admin.html dashboard
 *   ADMIN_TOKEN_SECRET       - random 32+ char string, used to sign admin session tokens
 *   GOOGLE_SERVICE_ACCOUNT   - full JSON key of a Google service account, as a single string
 *   GOOGLE_SHEET_ID          - the spreadsheet ID that logs transactions
 *
 * Required vars (wrangler.toml [vars]):
 *   ALLOWED_ORIGIN           - your GitHub Pages origin, e.g. https://kabaa01.github.io
 *   PRICE_USD_CENTS          - price for one unlock, e.g. 200 for $2.00
 *   SITE_URL                 - same as ALLOWED_ORIGIN, used for Stripe redirect URLs
 */

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function json(data, status, env) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json", ...corsHeaders(env) },
  });
}

// ---------------------------------------------------------------------------
// Stripe helpers (raw REST — no SDK dependency)
// ---------------------------------------------------------------------------
async function stripeRequest(env, path, params) {
  const body = new URLSearchParams(params);
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Stripe request failed");
  return data;
}

async function stripeGet(env, path) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Stripe request failed");
  return data;
}

async function createCheckoutSession(env, beverage) {
  const data = await stripeRequest(env, "checkout/sessions", {
    mode: "payment",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]": `Brew water report — ${beverage}`,
    "line_items[0][price_data][unit_amount]": String(env.PRICE_USD_CENTS || 200),
    "line_items[0][quantity]": "1",
    success_url: `${env.SITE_URL}/index.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.SITE_URL}/index.html`,
  });
  return data;
}

// Verifies the Stripe-Signature header using HMAC-SHA256 (Web Crypto).
async function verifyStripeSignature(payload, sigHeader, secret) {
  const parts = Object.fromEntries(
    sigHeader.split(",").map((kv) => kv.split("="))
  );
  const signedPayload = `${parts.t}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const expected = [...new Uint8Array(sigBuf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return expected === parts.v1;
}

// ---------------------------------------------------------------------------
// Google Sheets (service-account JWT bearer flow, REST only)
// ---------------------------------------------------------------------------
function pemToArrayBuffer(pem) {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const raw = atob(b64);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf.buffer;
}

function base64url(input) {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getGoogleAccessToken(env) {
  const sa = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const claims = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })
  );
  const unsigned = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const sig = base64url(String.fromCharCode(...new Uint8Array(sigBuf)));
  const jwt = `${unsigned}.${sig}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error("Google auth failed: " + JSON.stringify(data));
  return data.access_token;
}

async function appendTransactionRow(env, row) {
  const token = await getGoogleAccessToken(env);
  const range = "Transactions!A:D";
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_SHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [row] }),
    }
  );
}

async function readTransactionRows(env) {
  const token = await getGoogleAccessToken(env);
  const range = "Transactions!A:D";
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_SHEET_ID}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  const rows = (data.values || []).slice(1); // skip header row
  return rows.reverse().slice(0, 100).map((r) => ({
    date: r[0] || "", beverage: r[1] || "", amount: r[2] || "", status: r[3] || "",
  }));
}

// ---------------------------------------------------------------------------
// Admin session tokens (HMAC-signed, no external JWT library needed)
// ---------------------------------------------------------------------------
async function signAdminToken(env) {
  const payload = base64url(JSON.stringify({ exp: Date.now() + 1000 * 60 * 60 * 8 }));
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(env.ADMIN_TOKEN_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const sig = base64url(String.fromCharCode(...new Uint8Array(sigBuf)));
  return `${payload}.${sig}`;
}

async function verifyAdminToken(env, token) {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(env.ADMIN_TOKEN_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const expected = base64url(String.fromCharCode(...new Uint8Array(sigBuf)));
  if (expected !== sig) return false;
  const { exp } = JSON.parse(atob(payload));
  return Date.now() < exp;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(env) });
    }

    try {
      if (url.pathname === "/create-checkout-session" && request.method === "POST") {
        const { beverage } = await request.json();
        const session = await createCheckoutSession(env, beverage || "brew");
        return json({ url: session.url }, 200, env);
      }

      if (url.pathname === "/verify" && request.method === "GET") {
        const sessionId = url.searchParams.get("session_id");
        const session = await stripeGet(env, `checkout/sessions/${sessionId}`);
        return json({ paid: session.payment_status === "paid" }, 200, env);
      }

      if (url.pathname === "/webhook" && request.method === "POST") {
        const payload = await request.text();
        const sig = request.headers.get("Stripe-Signature") || "";
        const ok = await verifyStripeSignature(payload, sig, env.STRIPE_WEBHOOK_SECRET);
        if (!ok) return json({ error: "invalid signature" }, 400, env);
        const event = JSON.parse(payload);
        if (event.type === "checkout.session.completed" && env.GOOGLE_SERVICE_ACCOUNT && env.GOOGLE_SHEET_ID) {
          const s = event.data.object;
          try {
            await appendTransactionRow(env, [
              new Date().toISOString(),
              s.metadata?.beverage || "unknown",
              ((s.amount_total || 0) / 100).toFixed(2) + " " + (s.currency || "usd").toUpperCase(),
              "paid",
            ]);
          } catch (sheetErr) {
            // Never fail the webhook (and trigger Stripe retries) just because
            // logging failed — the payment itself is already confirmed by Stripe.
            console.error("Sheets logging failed:", sheetErr.message);
          }
        }
        return json({ received: true }, 200, env);
      }

      if (url.pathname === "/admin/login" && request.method === "POST") {
        const { password } = await request.json();
        if (password !== env.ADMIN_PASSWORD) return json({ error: "invalid" }, 401, env);
        const token = await signAdminToken(env);
        return json({ token }, 200, env);
      }

      if (url.pathname === "/admin/transactions" && request.method === "GET") {
        const auth = request.headers.get("Authorization") || "";
        const token = auth.replace("Bearer ", "");
        if (!(await verifyAdminToken(env, token))) return json({ error: "unauthorized" }, 401, env);
        if (!env.GOOGLE_SERVICE_ACCOUNT || !env.GOOGLE_SHEET_ID) {
          return json({ error: "Google Sheets not configured — view payments in your Stripe Dashboard instead." }, 200, env);
        }
        const rows = await readTransactionRows(env);
        return json(rows, 200, env);
      }

      return json({ error: "not found" }, 404, env);
    } catch (err) {
      return json({ error: err.message }, 500, env);
    }
  },
};
