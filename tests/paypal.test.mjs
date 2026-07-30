// Regression tests for the Stripe → PayPal migration and related requests:
// no leftover Stripe code, no "grown-up" wording, glossary present.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const workerSrc = read("worker/src/index.js");
const indexHtml = read("index.html");
const appJs = read("app.js");
const configJs = read("config.js");
const wranglerToml = read("worker/wrangler.toml");

test("worker has no leftover Stripe code", () => {
  assert.ok(!/stripe/i.test(workerSrc), "worker/src/index.js still references Stripe");
});

test("frontend has no leftover Stripe code", () => {
  assert.ok(!/stripe/i.test(appJs), "app.js still references Stripe");
});

test("worker implements the PayPal order endpoints", () => {
  assert.match(workerSrc, /\/create-order/);
  assert.match(workerSrc, /\/capture-order/);
  assert.match(workerSrc, /paypalBase|api-m\.paypal\.com/);
});

test('no "grown-up" wording remains anywhere in the frontend', () => {
  assert.ok(!/grown[\s-]?up/i.test(indexHtml));
  assert.ok(!/grown[\s-]?up/i.test(appJs));
});

test("price is not hardcoded in the frontend — it's fetched from the Worker", () => {
  assert.ok(!/\$2\.00|\$5\.00/.test(indexHtml), "a dollar amount is hardcoded in index.html instead of coming from /price");
  assert.match(appJs, /\/price/);
});

test("config.js provides a PayPal client ID field", () => {
  assert.match(configJs, /paypalClientId/);
});

test("wrangler.toml defines the PayPal vars and current price", () => {
  assert.match(wranglerToml, /PAYPAL_CLIENT_ID/);
  assert.match(wranglerToml, /PAYPAL_MODE/);
  assert.match(wranglerToml, /PRICE_USD_CENTS\s*=\s*"500"/);
});

test("index.html includes a glossary covering the key acronyms", () => {
  for (const term of ["pH", "TDS", "CaCO", "SCA", "WHO", "KEBS"]) {
    assert.ok(indexHtml.includes(term), `glossary missing ${term}`);
  }
});
