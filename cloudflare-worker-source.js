/**
 * Steep & Standard — payment verification Worker.
 *
 * WHERE THIS RUNS: this file is NOT deployed automatically. There is no
 * build step and no CLI. You paste this into the Cloudflare dashboard's
 * web-based code editor and click Deploy. See README "Setting up real
 * payment verification" for the exact click-by-click steps.
 *
 * WHAT IT DOES: exactly two jobs — create a PayPal order, and capture
 * (verify + finalize) it once the buyer approves. Nothing else. No email
 * sending, no spreadsheet logging, no admin dashboard, no other payment
 * processor. If you want those back later, ask — this file stays small
 * on purpose.
 *
 * Variables to set in the dashboard (Settings → Variables and Secrets),
 * all added by clicking "Add" — no file, no command line:
 *   PAYPAL_CLIENT_ID       (Variable — not secret, safe to expose)
 *   PAYPAL_CLIENT_SECRET   (Secret)
 *   PAYPAL_MODE             "live" or "sandbox"      (Variable)
 *   ALLOWED_ORIGIN          your GitHub Pages URL     (Variable)
 *   PRICE_USD_CENTS         e.g. "500" for $5.00       (Variable)
 */

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(data, status, env) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json", ...corsHeaders(env) },
  });
}

function paypalBase(env) {
  return env.PAYPAL_MODE === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";
}

async function getAccessToken(env) {
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
        const token = await getAccessToken(env);
        const amount = ((Number(env.PRICE_USD_CENTS) || 500) / 100).toFixed(2);
        const res = await fetch(`${paypalBase(env)}/v2/checkout/orders`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            intent: "CAPTURE",
            purchase_units: [{
              description: `Brew water report — ${beverage || "brew"}`.slice(0, 127),
              amount: { currency_code: "USD", value: amount },
            }],
          }),
        });
        const order = await res.json();
        if (!res.ok) throw new Error(order.message || "Could not create order");
        return json({ id: order.id }, 200, env);
      }

      if (url.pathname === "/capture-order" && request.method === "POST") {
        const { orderID } = await request.json();
        const token = await getAccessToken(env);
        const res = await fetch(`${paypalBase(env)}/v2/checkout/orders/${orderID}/capture`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.message || "Could not capture order");
        // This is the actual verification: PayPal itself confirms COMPLETED.
        return json({ status: result.status, id: result.id }, 200, env);
      }

      return json({ error: "not found" }, 404, env);
    } catch (err) {
      return json({ error: err.message }, 500, env);
    }
  },
};
