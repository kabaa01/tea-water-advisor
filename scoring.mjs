/* Pure scoring logic — no DOM, no network. Imported by app.js (browser)
   and by tests/scoring.test.mjs (Node). Keep this file dependency-free. */

export const PROFILES = {
  green: {
    label: "Green tea",
    ph: { lo: 6.5, target: 7.0, hi: 7.2, note: "Neutral pH gives the best balance of extraction without pushing bitterness. Green tea is the most sensitive type to over-alkaline water." },
    tds: { lo: 50, target: 90, hi: 150 },
    hardness: { lo: 17, target: 50, hi: 85, note: "Moderate calcium adds body; excess magnesium reads as metallic/bitter in delicate teas." },
  },
  black: {
    label: "Black tea",
    ph: { lo: 6.5, target: 7.0, hi: 7.5 },
    tds: { lo: 50, target: 120, hi: 150 },
    hardness: { lo: 17, target: 68, hi: 85, note: "Black tea tolerates slightly more mineral content than green before turning flat." },
  },
  oolong: {
    label: "Oolong tea",
    ph: { lo: 6.5, target: 7.0, hi: 7.2 },
    tds: { lo: 50, target: 100, hi: 150 },
    hardness: { lo: 17, target: 55, hi: 85 },
  },
  white: {
    label: "White tea",
    ph: { lo: 6.5, target: 6.8, hi: 7.0, note: "The most delicate type — treat like green tea but with even less tolerance for hard or alkaline water." },
    tds: { lo: 50, target: 80, hi: 120 },
    hardness: { lo: 17, target: 40, hi: 68 },
  },
  herbal: {
    label: "Herbal / rooibos",
    ph: { lo: 6.5, target: 7.0, hi: 7.5 },
    tds: { lo: 50, target: 120, hi: 200 },
    hardness: { lo: 17, target: 68, hi: 100 },
  },
  coffee: {
    label: "Coffee (SCA Golden Cup standard)",
    ph: { lo: 6.5, target: 7.0, hi: 7.5 },
    tds: { lo: 75, target: 150, hi: 250 },
    hardness: { lo: 17, target: 68, hi: 85, note: "SCA calcium-hardness target is 68 mg/L as CaCO3 (1–5 grains); below ~50 mg/L cups taste bright but thin." },
    alkalinity: { lo: 0, target: 40, hi: 70 },
  },
};

export const FLUORIDE_SAFE_LIMIT_MGL = 1.5; // WHO/KEBS guideline for drinking water

export function scoreParam(value, range) {
  if (value == null || Number.isNaN(value)) return null;
  const { lo, target, hi } = range;
  if (value < lo || value > hi) return { status: "out", pct: 0 };
  const span = value <= target ? (target - lo) : (hi - target);
  const dist = Math.abs(value - target);
  const pct = span === 0 ? 100 : Math.max(0, 100 - (dist / span) * 60); // stays 40-100 inside range
  return { status: pct > 80 ? "ideal" : "ok", pct: Math.round(pct) };
}

export function buildAdvice(input) {
  const profile = PROFILES[input.beverage];
  if (!profile) throw new Error(`Unknown beverage: ${input.beverage}`);
  const notes = [];
  const scores = {};
  let total = 0, count = 0;

  scores.ph = scoreParam(input.ph, profile.ph);
  scores.tds = scoreParam(input.tds, profile.tds);
  scores.hardness = scoreParam(input.hardness, profile.hardness);
  if (profile.alkalinity) scores.alkalinity = scoreParam(input.alkalinity, profile.alkalinity);

  for (const key in scores) {
    if (scores[key]) { total += scores[key].pct; count++; }
  }
  const overall = count ? Math.round(total / count) : null;

  if (scores.ph) {
    if (input.ph < profile.ph.lo) notes.push("Water is on the acidic side — expect a sharper, thinner cup. Bicarbonate soda or blending with a more alkaline source can lift body.");
    else if (input.ph > profile.ph.hi) notes.push("Water is fairly alkaline — expect a flatter, sometimes soapy or metallic note. A carbon filter or acid-adjusted blend usually helps.");
    else notes.push("pH sits in the favorable range for this brew.");
  }
  if (scores.tds) {
    if (input.tds < profile.tds.lo) notes.push("Total dissolved solids are low — extraction may taste thin or under-developed. Very soft/RO water often needs a mineral booster.");
    else if (input.tds > profile.tds.hi) notes.push("TDS is high — minerals may overpower delicate notes and mute the cup.");
  }
  if (scores.hardness) {
    if (input.hardness > profile.hardness.hi) notes.push("Hardness is high — expect scale buildup in kettles and a duller, sometimes chalky taste.");
    else if (input.hardness < profile.hardness.lo) notes.push("Hardness is quite low — the cup may taste sour or thin from under-extraction.");
  }
  if (profile.alkalinity && scores.alkalinity && input.alkalinity > profile.alkalinity.hi) {
    notes.push("Alkalinity above ~40–70 mg/L tends to neutralize desirable acidity, flattening bright, fruity notes.");
  }
  if (input.fluoride != null && input.fluoride > FLUORIDE_SAFE_LIMIT_MGL) {
    notes.push(`⚠ Fluoride reading (${input.fluoride} mg/L) is above the WHO/KEBS guideline of ${FLUORIDE_SAFE_LIMIT_MGL} mg/L. This is a health/safety flag, not a taste note — verify with an accredited lab before using this water for regular drinking or infant formula.`);
  }
  if (input.chlorine === true) {
    notes.push("Tap water with residual chlorine/chloramine will mask delicate aromatics. Let it stand uncovered 30 min or use a carbon filter.");
  }

  return { profile, overall, scores, notes };
}
