// Run with: node scripts/check-ready.mjs
// Tells you exactly what's left before the site can take real payments.
import fs from "node:fs";

const checks = [];
const config = fs.readFileSync(new URL("../config.js", import.meta.url), "utf8");

checks.push({
  name: "Worker URL set in config.js",
  ok: !config.includes("YOUR-SUBDOMAIN"),
  fix: "Deploy the Worker (npx wrangler deploy from /worker), then paste its URL into config.js.",
});

checks.push({
  name: "wrangler.toml origin matches a real GitHub Pages URL",
  ok: fs.readFileSync(new URL("../worker/wrangler.toml", import.meta.url), "utf8").includes("github.io"),
  fix: "Set ALLOWED_ORIGIN and SITE_URL in worker/wrangler.toml to your github.io URL.",
});

let allOk = true;
for (const c of checks) {
  console.log(`${c.ok ? "✅" : "❌"} ${c.name}`);
  if (!c.ok) { console.log(`   → ${c.fix}`); allOk = false; }
}
console.log("\nReminder — these can't be checked from code, confirm manually:");
console.log("  • Stripe webhook endpoint added, pointing at <worker-url>/webhook");
console.log("  • Worker secrets set: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, ADMIN_PASSWORD, ADMIN_TOKEN_SECRET");
console.log("  • One real test-mode purchase completed end-to-end");

process.exit(allOk ? 0 : 1);
