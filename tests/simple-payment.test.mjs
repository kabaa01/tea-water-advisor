// Regression tests for the simplified, backend-free deployment: a plain
// PayPal.me link, no Worker/Stripe/PayPal-SDK/Cloudflare/Resend/Sheets
// dependency anywhere, and an honest (non-fabricated) confirmation message.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const indexHtml = read("index.html");
const appJs = read("app.js");
const configJs = read("config.js");

const forbidden = [
  "stripe", "wrangler", "cloudflare", "paypal.com/sdk", "workers.dev",
  "resend", "google", "sheets.googleapis", "create-order", "capture-order",
  "grown-up", "grown up",
];

test("no backend/API/service-provider dependency remains anywhere in the frontend", () => {
  const haystack = (indexHtml + appJs + configJs).toLowerCase();
  for (const term of forbidden) {
    assert.ok(!haystack.includes(term.toLowerCase()), `found forbidden leftover term: "${term}"`);
  }
});

test("worker/, admin.html, and .github/workflows/deploy-worker.yml no longer exist", () => {
  assert.ok(!fs.existsSync(new URL("../worker", import.meta.url)));
  assert.ok(!fs.existsSync(new URL("../admin.html", import.meta.url)));
  assert.ok(!fs.existsSync(new URL("../.github/workflows/deploy-worker.yml", import.meta.url)));
});

test("config.js exposes a payPalLink and priceLabel, nothing sensitive", () => {
  assert.match(configJs, /payPalLink/);
  assert.match(configJs, /priceLabel/);
  assert.ok(!/secret|key|token/i.test(configJs), "config.js should never need a secret — it's a public file");
});

test("payment flow is a plain link plus a self-report button — no fetch() calls at all", () => {
  assert.ok(!/fetch\(/.test(appJs), "app.js should make zero network calls in the simplified version");
  assert.match(appJs, /pay-link/);
  assert.match(appJs, /paid-btn/);
});

test("the page does not fabricate a confirmation code — it points to PayPal's real receipt email instead", () => {
  assert.ok(!/confirmation-code/i.test(indexHtml), "no fake confirmation code should be displayed without real verification");
  assert.match(indexHtml, /receipt/i);
});

test("scoring engine is untouched by the payment simplification — still six full profiles", () => {
  for (const key of ["green", "black", "oolong", "white", "herbal", "coffee"]) {
    assert.match(appJs, new RegExp(`${key}:\\s*\\{\\s*label:`), `missing profile: ${key}`);
  }
});

test("reveal button cannot be used until the PayPal link has been clicked and confirmed", () => {
  assert.match(indexHtml, /id="paid-checkbox"[^>]*disabled/, "confirmation checkbox should start disabled");
  assert.match(indexHtml, /id="paid-btn"[^>]*disabled/, "reveal button should start disabled");
  assert.match(appJs, /paidCheckbox\.disabled = false/, "clicking the PayPal link should be what enables the checkbox");
  assert.match(appJs, /paidBtn\.disabled = !paidCheckbox\.checked/, "reveal button should only enable once the checkbox is checked");
});

test("the page states plainly, at decision time, that payment cannot be auto-verified", () => {
  assert.match(indexHtml, /can't automatically verify PayPal payments/i);
});

test("confirmation state resets on every new water reading, not left over from a prior one", () => {
  assert.match(appJs, /paidCheckbox\.checked = false;/);
  assert.match(appJs, /paidCheckbox\.disabled = true;/);
});
