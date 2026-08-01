/**
 * Tea & Coffee Brewing Water Advisor — backend worker.
 * Payment processor: PayPal (Orders API v2).
 *
 * Required secrets (set with `wrangler secret put <NAME>`):
 *   PAYPAL_CLIENT_SECRET     - from your PayPal REST API app (developer.paypal.com)
 *   PAYPAL_WEBHOOK_ID        - only needed if you configure a PayPal webhook
 *   RESEND_API_KEY           - optional, sends the buyer a payment-confirmation email
 *   ADMIN_PASSWORD           - password for the /admin.html dashboard
 *   ADMIN_TOKEN_SECRET       - random 32+ char string, used to sign admin session tokens
 *   GOOGLE_SERVICE_ACCOUNT   - optional, full JSON key of a Google service account
 *   GOOGLE_SHEET_ID          - optional, the spreadsheet ID that logs transactions
 *
 * Required vars (wrangler.toml [vars]):
 *   PAYPAL_CLIENT_ID         - from the same REST API app (not secret — safe to expose)
 *   PAYPAL_MODE              - "live" or "sandbox"
 *   RESEND_FROM_EMAIL        - e.g. "Steep & Standard <receipts@yourdomain.com>" (needs a verified domain in Resend)
 *   ALLOWED_ORIGIN           - your GitHub Pages origin, e.g. https://kabaa01.github.io
 *   SITE_URL                 - same site, used for reference only
 *   PRICE_USD_CENTS          - price for one unlock, e.g. 500 for $5.00
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
// PayPal helpers (REST API v2, no SDK dependency — just fetch)
// ---------------------------------------------------------------------------
function paypalBase(env) {
  return env.PAYPAL_MODE === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";
}

async function getPayPalAccessToken(env) {
  const auth = btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`);
  const res = await fetch(`${paypalBase(env)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || "PayPal authentication failed");
  return data.access_token;
}

async function createPayPalOrder(env, beverage) {
  const token = await getPayPalAccessToken(env);
  const amount = ((Number(env.PRICE_USD_CENTS) || 500) / 100).toFixed(2);
  const res = await fetch(`${paypalBase(env)}/v2/checkout/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          description: `Brew water report — ${beverage}`.slice(0, 127),
          amount: { currency_code: "USD", value: amount },
        },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Could not create PayPal order");
  return data;
}

async function capturePayPalOrder(env, orderId) {
  const token = await getPayPalAccessToken(env);
  const res = await fetch(`${paypalBase(env)}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Could not capture PayPal order");
  return data;
}

// Verifies an incoming PayPal webhook using PayPal's own verification endpoint.
// Only used if you've configured PAYPAL_WEBHOOK_ID; safe to skip otherwise.
async function verifyPayPalWebhook(env, headers, rawBody) {
  const token = await getPayPalAccessToken(env);
  const payload = {
    transmission_id: headers.get("paypal-transmission-id"),
    transmission_time: headers.get("paypal-transmission-time"),
    cert_url: headers.get("paypal-cert-url"),
    auth_algo: headers.get("paypal-auth-algo"),
    transmission_sig: headers.get("paypal-transmission-sig"),
    webhook_id: env.PAYPAL_WEBHOOK_ID,
    webhook_event: JSON.parse(rawBody),
  };
  const res = await fetch(`${paypalBase(env)}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return data.verification_status === "SUCCESS";
}

// ---------------------------------------------------------------------------
// Google Sheets (optional transaction logging — service-account JWT bearer flow)
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
  const rows = (data.values || []).slice(1);
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
// Payment-confirmation email (optional — via Resend's REST API)
// ---------------------------------------------------------------------------
async function sendConfirmationEmail(env, { toEmail, confirmationCode, beverage, amount }) {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL || !toEmail) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: [toEmail],
      subject: "Your Steep & Standard payment confirmation",
      html: `
        <p>Thanks for your payment.</p>
        <p><strong>Confirmation code:</strong> ${confirmationCode}</p>
        <p><strong>Item:</strong> Brew water report — ${beverage}</p>
        <p><strong>Amount:</strong> ${amount}</p>
        <p>Keep this email as your receipt. If you have any questions about this
        charge, reply with your confirmation code above.</p>
      `,
    }),
  });
  return res.ok;
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
      if (url.pathname === "/price" && request.method === "GET") {
        return json({ cents: Number(env.PRICE_USD_CENTS) || 500 }, 200, env);
      }

      if (url.pathname === "/create-order" && request.method === "POST") {
        const { beverage } = await request.json();
        const order = await createPayPalOrder(env, beverage || "brew");
        return json({ id: order.id }, 200, env);
      }

      if (url.pathname === "/capture-order" && request.method === "POST") {
        const { orderID } = await request.json();
        const result = await capturePayPalOrder(env, orderID);

        let emailSent = false;
        if (result.status === "COMPLETED") {
          const purchaseUnit = result.purchase_units?.[0];
          const capture = purchaseUnit?.payments?.captures?.[0];
          const toEmail = result.payer?.email_address;
          const amount = capture?.amount
            ? `${capture.amount.value} ${capture.amount.currency_code}`
            : "";
          try {
            emailSent = await sendConfirmationEmail(env, {
              toEmail,
              confirmationCode: result.id,
              beverage: purchaseUnit?.description || "brew",
              amount,
            });
          } catch (emailErr) {
            // Never fail the payment just because the confirmation email didn't send.
            console.error("Confirmation email failed:", emailErr.message);
          }
        }

        return json({ status: result.status, id: result.id, emailSent }, 200, env);
      }

      if (url.pathname === "/webhook" && request.method === "POST") {
        const rawBody = await request.text();
        if (env.PAYPAL_WEBHOOK_ID) {
          const ok = await verifyPayPalWebhook(env, request.headers, rawBody);
          if (!ok) return json({ error: "invalid signature" }, 400, env);
        }
        const event = JSON.parse(rawBody);
        if (event.event_type === "PAYMENT.CAPTURE.COMPLETED" && env.GOOGLE_SERVICE_ACCOUNT && env.GOOGLE_SHEET_ID) {
          try {
            const resource = event.resource || {};
            await appendTransactionRow(env, [
              new Date().toISOString(),
              resource.custom_id || "unknown",
              (resource.amount?.value || "") + " " + (resource.amount?.currency_code || "USD"),
              "paid",
            ]);
          } catch (sheetErr) {
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
          return json({ error: "Google Sheets not configured — view payments in your PayPal Dashboard instead." }, 200, env);
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
