// Regression tests for the dual-mode payment setup: a manual PayPal.me
// fallback that works with zero backend, plus an optional real-verification
// path (cloudflare-worker-source.js) that the frontend only uses once it's
// actually configured. No Stripe, Resend, Google Sheets, admin dashboard,
// or local npm/wrangler tooling anywhere in the repo.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const indexHtml = read("index.html");
const appJs = read("app.js");
const configJs = read("config.js");
const workerSrc = read("cloudflare-worker-source.js");

const forbidden = ["stripe", "resend", "google", "sheets.googleapis", "grown-up", "grown up"];

test("no leftover unrelated service dependency anywhere in the project", () => {
  const haystack = (indexHtml + appJs + configJs + workerSrc).toLowerCase();
  for (const term of forbidden) {
    assert.ok(!haystack.includes(term.toLowerCase()), `found forbidden leftover term: "${term}"`);
  }
});

test("worker/, admin.html, and any local Worker tooling no longer exist", () => {
  assert.ok(!fs.existsSync(new URL("../worker", import.meta.url)), "the old worker/ folder should never come back");
  assert.ok(!fs.existsSync(new URL("../admin.html", import.meta.url)));
  assert.ok(!fs.existsSync(new URL("../.github/workflows/deploy-worker.yml", import.meta.url)));
  assert.ok(!fs.existsSync(new URL("../node_modules", import.meta.url)), "the Worker is dashboard-deployed \u2014 nothing should ever be npm-installed in this repo");
  assert.ok(!fs.existsSync(new URL("../wrangler.toml", import.meta.url)), "the dashboard editor needs no wrangler config file");
});

test("cloudflare-worker-source.js is a single flat file with only the two verification jobs", () => {
  assert.match(workerSrc, /\/create-order/);
  assert.match(workerSrc, /\/capture-order/);
  assert.match(workerSrc, /is NOT deployed automatically/i, "the file must say plainly it's copy-paste, not auto-deployed");
});

test("config.js exposes only non-secret values", () => {
  assert.match(configJs, /payPalLink/);
  assert.match(configJs, /priceLabel/);
  assert.match(configJs, /workerBase/);
  assert.match(configJs, /paypalClientId/);
  assert.ok(!/secret/i.test(configJs), "config.js should never hold a secret \u2014 it's a public file");
});

test("frontend auto-detects verified vs manual mode instead of requiring a code change", () => {
  assert.match(appJs, /function verificationConfigured/);
  assert.match(appJs, /setUpVerifiedPayment/);
  assert.match(appJs, /setUpManualPayment/);
});

test("verified path only unlocks the report after PayPal itself returns COMPLETED", () => {
  assert.match(appJs, /result\.status === "COMPLETED"/);
  assert.match(appJs, /renderFullReport\(lastAdvice\); \/\/ only reached after PayPal itself confirms/);
});

test("manual fallback still exists and still has its click-then-confirm safeguard", () => {
  assert.match(indexHtml, /id="paid-checkbox"[^>]*disabled/);
  assert.match(indexHtml, /id="paid-btn"[^>]*disabled/);
  assert.match(appJs, /paidCheckbox\.disabled = false/);
  assert.match(indexHtml, /can't automatically verify PayPal payments/i);
});

test("the page does not fabricate a confirmation code in either mode", () => {
  assert.ok(!/confirmation-code/i.test(indexHtml));
});

test("scoring engine is untouched \u2014 still six full beverage profiles", () => {
  for (const key of ["green", "black", "oolong", "white", "herbal", "coffee"]) {
    assert.match(appJs, new RegExp(`${key}:\\s*\\{\\s*label:`), `missing profile: ${key}`);
  }
});
