// Regression test for the "site loaded at a subpath, absolute paths 404'd,
// nothing worked" bug. Fails the build if any local asset reference uses
// a leading-slash absolute path instead of a relative one.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const files = ["index.html", "manifest.json", "sw.js", "app.js"];
const offenders = [];

for (const file of files) {
  const text = fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const matches = text.match(/(?:href|src)="\/(?!\/)[^"]*"|"\/(?:icons|index\.html|manifest\.json|sw\.js|app\.js|styles\.css)[^"]*"/g) || [];
  if (matches.length) offenders.push({ file, matches });
}

test("no local asset reference uses an absolute root path", () => {
  assert.deepEqual(offenders, [], `Found absolute-root paths (breaks GitHub Pages project sites): ${JSON.stringify(offenders)}`);
});
