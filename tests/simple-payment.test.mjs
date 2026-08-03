// Regression tests for the manual PayPal.me flow with human-checked
// verification (email to belltowerkenya@gmail.com) instead of any
// automated Worker-based check, plus the expanded detailed report.
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
  "stripe", "resend", "google", "sheets.googleapis", "grown-up", "grown up",
  "wrangler", "cloudflare", "workers.dev", "paypal.com/sdk",
  "create-order", "capture-order", "verificationconfigured", "setupverifiedpayment",
];

test("no automated/backend verification remains anywhere in the frontend", () => {
  const haystack = (indexHtml + appJs + configJs).toLowerCase();
  for (const term of forbidden) {
    assert.ok(!haystack.includes(term.toLowerCase()), `found forbidden leftover term: "${term}"`);
  }
});

test("cloudflare-worker-source.js and worker/ no longer exist", () => {
  assert.ok(!fs.existsSync(new URL("../cloudflare-worker-source.js", import.meta.url)));
  assert.ok(!fs.existsSync(new URL("../worker", import.meta.url)));
  assert.ok(!fs.existsSync(new URL("../admin.html", import.meta.url)));
});

test("config.js exposes only non-secret values, including the verification email", () => {
  assert.match(configJs, /payPalLink/);
  assert.match(configJs, /priceLabel/);
  assert.match(configJs, /verificationEmail/);
  assert.match(configJs, /belltowerkenya@gmail\.com/);
  assert.ok(!/secret|api[_-]?key/i.test(configJs));
});

test("the verify-by-email step lives inside the unlocked report, not gating access to it", () => {
  // "verify-box" must be inside result-unlocked, not result-locked
  const lockedIdx = indexHtml.indexOf('id="result-locked"');
  const unlockedIdx = indexHtml.indexOf('id="result-unlocked"');
  const verifyIdx = indexHtml.indexOf('class="verify-box"');
  assert.ok(verifyIdx > unlockedIdx && unlockedIdx > lockedIdx, "verify-box should appear after result-unlocked opens");
});

test("verify-by-email instructions are brief (a short numbered list, not a wall of text)", () => {
  const match = indexHtml.match(/<ol class="verify-steps">([\s\S]*?)<\/ol>/);
  assert.ok(match, "expected a short ordered list of verification steps");
  const items = match[1].match(/<li>/g) || [];
  assert.ok(items.length >= 2 && items.length <= 5, `expected 2-5 brief steps, found ${items.length}`);
});

test("payment gate is now two simple steps with no fake auto-verification claim", () => {
  assert.match(indexHtml, /1\. Pay with PayPal/);
  assert.match(indexHtml, /2\. Show my report/);
  assert.match(appJs, /payLink\.addEventListener\("click", \(\) => \{\s*paidBtn\.disabled = false;/);
});

test("detailed report covers every tested parameter with an explanation, not just one-line notes", () => {
  assert.match(appJs, /function buildDetailedReport/);
  assert.match(appJs, /pH — acidity \/ alkalinity/);
  assert.match(appJs, /TDS — Total Dissolved Solids/);
  assert.match(appJs, /Hardness \(Calcium\/Magnesium/);
  assert.match(appJs, /BREW_GUIDANCE/);
});

test("brewing guidance exists for all six beverages", () => {
  for (const key of ["green", "black", "oolong", "white", "herbal", "coffee"]) {
    assert.match(appJs, new RegExp(`${key}:\\s*\\{\\s*temp:`), `missing brew guidance for ${key}`);
  }
});

test("scoring engine is untouched — still six full beverage profiles", () => {
  for (const key of ["green", "black", "oolong", "white", "herbal", "coffee"]) {
    assert.match(appJs, new RegExp(`${key}:\\s*\\{\\s*label:`), `missing profile: ${key}`);
  }
});
