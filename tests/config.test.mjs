// Regression tests for: admin link removed from public UI, config.js is the
// single source of truth for the Worker URL (no duplicated hardcoded URLs).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const indexHtml = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const adminHtml = fs.readFileSync(new URL("../admin.html", import.meta.url), "utf8");
const configJs = fs.readFileSync(new URL("../config.js", import.meta.url), "utf8");

test("public index.html has no visible admin link", () => {
  assert.ok(!/admin-link|href="\.\/admin\.html"/.test(indexHtml));
});

test("index.html and admin.html both load config.js", () => {
  assert.match(indexHtml, /src="\.\/config\.js"/);
  assert.match(adminHtml, /src="\.\/config\.js"/);
});

test("only config.js contains the workers.dev placeholder — no duplicate hardcoded URLs", () => {
  assert.ok(!indexHtml.includes("workers.dev"), "index.html should read the URL from config.js, not hardcode it");
  assert.ok(!adminHtml.includes("workers.dev"), "admin.html should read the URL from config.js, not hardcode it");
  assert.match(configJs, /workers\.dev/);
});

test("admin.html is still present as a direct-URL-only page (not deleted)", () => {
  assert.ok(fs.existsSync(new URL("../admin.html", import.meta.url)));
});
