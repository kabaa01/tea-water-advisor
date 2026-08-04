// Regression tests for the location-based water estimate. This deliberately
// tests the pure estimateForCountryCode() logic, not the geolocation/network
// call itself (which needs a real browser + real device permission).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const appJs = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

// app.js is a plain (non-module) browser script, so we eval just the pure
// data/logic section — up through estimateForCountryCode — in an isolated
// scope to unit-test it without a DOM.
const cut = appJs.indexOf("function scoreParam");
const pureSection = appJs.slice(0, cut);
const scope = {};
new Function("scope", pureSection + "\nscope.estimateForCountryCode = estimateForCountryCode; scope.REGION_ESTIMATES = REGION_ESTIMATES; scope.HARDNESS_BANDS = HARDNESS_BANDS;")(scope);
const { estimateForCountryCode, REGION_ESTIMATES, HARDNESS_BANDS } = scope;

test("a known country code returns a matched estimate with real numbers", () => {
  const est = estimateForCountryCode("KE");
  assert.equal(est.matched, true);
  assert.equal(est.name, "Kenya");
  assert.ok(est.hardness > 0 && est.tds > 0 && est.ph > 0);
});

test("Kenya specifically carries a fluoride caution flag", () => {
  const est = estimateForCountryCode("KE");
  assert.equal(est.fluorideCaution, true);
});

test("an unknown/uncovered country code falls back to a global moderate default instead of failing", () => {
  const est = estimateForCountryCode("ZZ");
  assert.equal(est.matched, false);
  assert.equal(est.name, null);
  assert.equal(est.band, "moderate");
  assert.ok(est.hardness > 0);
});

test("lowercase or missing country codes are handled without throwing", () => {
  assert.doesNotThrow(() => estimateForCountryCode("ke"));
  assert.doesNotThrow(() => estimateForCountryCode(undefined));
  assert.doesNotThrow(() => estimateForCountryCode(""));
  assert.equal(estimateForCountryCode("ke").matched, true, "country codes should be case-insensitive");
});

test("every region entry resolves to a real hardness band with positive values", () => {
  for (const code of Object.keys(REGION_ESTIMATES)) {
    const est = estimateForCountryCode(code);
    assert.ok(HARDNESS_BANDS[est.band], `${code} references an unknown band`);
    assert.ok(est.ph >= 6.5 && est.ph <= 8.5, `${code} pH out of plausible drinking-water range`);
  }
});

test("estimates are presented as a starting point, not a lab reading, in the UI copy", () => {
  assert.match(appJs, /not a reading of your actual tap/i);
});

test("location lookup is user-triggered only \u2014 no geolocation call fires on page load", () => {
  const clickHandlerIdx = appJs.indexOf('document.getElementById("use-location-btn").addEventListener("click"');
  const firstGeoCallIdx = appJs.indexOf("navigator.geolocation.getCurrentPosition");
  assert.ok(clickHandlerIdx !== -1, "expected a click listener on the location button");
  assert.ok(firstGeoCallIdx > clickHandlerIdx, "geolocation should only be requested inside the click handler");
});

test("no PayPal/payment code remains anywhere in the frontend", () => {
  const forbidden = ["paypal", "stripe", "payment", "pay-link", "verificationEmail", "grown-up", "grown up"];
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8").toLowerCase();
  const haystack = (appJs + html).toLowerCase();
  for (const term of forbidden) {
    assert.ok(!haystack.includes(term.toLowerCase()), `found forbidden leftover term: "${term}"`);
  }
});

test("config.js no longer exists \u2014 nothing left to configure", () => {
  assert.ok(!fs.existsSync(new URL("../config.js", import.meta.url)));
});

test("results show immediately after checking \u2014 no locked/unlocked gate remains", () => {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.ok(!html.includes('id="result-locked"'));
  assert.ok(!html.includes('id="result-unlocked"'));
});
