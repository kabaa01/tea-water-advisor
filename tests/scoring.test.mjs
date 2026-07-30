import test from "node:test";
import assert from "node:assert/strict";
import { buildAdvice, scoreParam, PROFILES } from "../scoring.mjs";

test("ideal SCA coffee water scores near 100%", () => {
  const advice = buildAdvice({ beverage: "coffee", ph: 7.0, tds: 150, hardness: 68, alkalinity: 40 });
  assert.ok(advice.overall >= 90, `expected >=90, got ${advice.overall}`);
});

test("very hard, alkaline water scores low for green tea", () => {
  const advice = buildAdvice({ beverage: "green", ph: 8.5, tds: 400, hardness: 300 });
  assert.ok(advice.overall < 30, `expected <30, got ${advice.overall}`);
  assert.ok(advice.notes.some(n => n.includes("alkaline")));
});

test("out-of-range values score 0 for that parameter, not a crash", () => {
  const s = scoreParam(50, PROFILES.coffee.ph); // pH 50 is nonsensical/out of range
  assert.equal(s.status, "out");
  assert.equal(s.pct, 0);
});

test("missing optional fields (no alkalinity for tea) do not throw", () => {
  assert.doesNotThrow(() => buildAdvice({ beverage: "black", ph: 7, tds: 120, hardness: 68 }));
});

test("fluoride above WHO/KEBS 1.5 mg/L triggers a safety flag, not a taste note", () => {
  const advice = buildAdvice({ beverage: "black", ph: 7, tds: 120, hardness: 68, fluoride: 2.1 });
  assert.ok(advice.notes.some(n => n.includes("Fluoride") && n.includes("WHO/KEBS")));
});

test("fluoride below the limit does not trigger the flag", () => {
  const advice = buildAdvice({ beverage: "black", ph: 7, tds: 120, hardness: 68, fluoride: 0.5 });
  assert.ok(!advice.notes.some(n => n.includes("Fluoride")));
});

test("chlorinated tap water adds a masking-flavor note", () => {
  const advice = buildAdvice({ beverage: "black", ph: 7, tds: 120, hardness: 68, chlorine: true });
  assert.ok(advice.notes.some(n => n.includes("chlorine")));
});

test("unknown beverage throws a clear error instead of silently failing", () => {
  assert.throws(() => buildAdvice({ beverage: "smoothie", ph: 7, tds: 100, hardness: 68 }), /Unknown beverage/);
});

test("all six beverage profiles are reachable and produce a numeric score", () => {
  for (const key of Object.keys(PROFILES)) {
    const advice = buildAdvice({ beverage: key, ph: 7, tds: 100, hardness: 60, alkalinity: 40 });
    assert.equal(typeof advice.overall, "number");
  }
});

test("scoreParam never returns a percentage outside 0-100", () => {
  const cases = [0, 6.5, 7.0, 7.2, 14, -5];
  for (const v of cases) {
    const s = scoreParam(v, PROFILES.green.ph);
    if (s) assert.ok(s.pct >= 0 && s.pct <= 100, `pct out of bounds for ${v}: ${s.pct}`);
  }
});
