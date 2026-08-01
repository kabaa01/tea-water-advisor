// Regression tests for: email confirmation feature, and payment-UX
// improvements (no jarring alert() popups, visible confirmation code,
// hardened GitHub Actions deploy).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const workerSrc = read("worker/src/index.js");
const appJs = read("app.js");
const indexHtml = read("index.html");
const wranglerToml = read("worker/wrangler.toml");
const deployWorkflow = read(".github/workflows/deploy-worker.yml");

test("worker sends a confirmation email on successful capture, guarded so it can't break payment", () => {
  assert.match(workerSrc, /sendConfirmationEmail/);
  assert.match(workerSrc, /if \(!env\.RESEND_API_KEY/); // no-ops cleanly if unconfigured
});

test("capture-order response includes emailSent status for the frontend to use", () => {
  assert.match(workerSrc, /emailSent/);
});

test("frontend no longer uses alert() for payment errors — uses inline status instead", () => {
  assert.ok(!/alert\(/.test(appJs), "app.js should show inline status, not native alert() popups");
  assert.match(appJs, /payment-status/);
});

test("confirmation code is shown to the buyer immediately on-screen, not only by email", () => {
  assert.match(indexHtml, /confirmation-banner/);
  assert.match(indexHtml, /confirmation-code/);
  assert.match(appJs, /confirmationCode/);
});

test("PayPal button flow handles cancellation distinctly from failure", () => {
  assert.match(appJs, /onCancel/);
});

test("wrangler.toml documents RESEND_FROM_EMAIL and an optional account_id override", () => {
  assert.match(wranglerToml, /RESEND_FROM_EMAIL/);
  assert.match(wranglerToml, /account_id/);
});

test("deploy-worker.yml passes an explicit accountId (common cause of first-deploy failures)", () => {
  assert.match(deployWorkflow, /accountId:\s*\$\{\{\s*secrets\.CLOUDFLARE_ACCOUNT_ID\s*\}\}/);
});
