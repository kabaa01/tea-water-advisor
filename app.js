/* ==========================================================================
   Steep & Standard — Perfect Brew Checker
   Plain script (no ES module import) so it can't break from a server
   serving .mjs with the wrong content-type. Scoring thresholds are
   sourced — see README. This is an estimate, not a certified water test.
   ========================================================================== */

const PROFILES = {
  green:  { label: "Green tea",  emoji: "🍵", ph: { lo: 6.5, target: 7.0, hi: 7.2 }, tds: { lo: 50, target: 90, hi: 150 }, hardness: { lo: 17, target: 50, hi: 85 } },
  black:  { label: "Black tea",  emoji: "🫖", ph: { lo: 6.5, target: 7.0, hi: 7.5 }, tds: { lo: 50, target: 120, hi: 150 }, hardness: { lo: 17, target: 68, hi: 85 } },
  oolong: { label: "Oolong tea", emoji: "🌿", ph: { lo: 6.5, target: 7.0, hi: 7.2 }, tds: { lo: 50, target: 100, hi: 150 }, hardness: { lo: 17, target: 55, hi: 85 } },
  white:  { label: "White tea",  emoji: "🤍", ph: { lo: 6.5, target: 6.8, hi: 7.0 }, tds: { lo: 50, target: 80, hi: 120 }, hardness: { lo: 17, target: 40, hi: 68 } },
  herbal: { label: "Herbal / rooibos", emoji: "🌺", ph: { lo: 6.5, target: 7.0, hi: 7.5 }, tds: { lo: 50, target: 120, hi: 200 }, hardness: { lo: 17, target: 68, hi: 100 } },
  coffee: { label: "Coffee",     emoji: "☕", ph: { lo: 6.5, target: 7.0, hi: 7.5 }, tds: { lo: 75, target: 150, hi: 250 }, hardness: { lo: 17, target: 68, hi: 85 }, alkalinity: { lo: 0, target: 40, hi: 70 } },
};

// General brewing guidance (widely published practice, not a controlled
// study) — shown in the detailed report alongside the water-chemistry read.
const BREW_GUIDANCE = {
  green:  { temp: "75–80°C (167–176°F)", steep: "2–3 minutes", note: "Water hotter than this tends to pull out more bitterness than flavor from green tea." },
  black:  { temp: "95–100°C (203–212°F)", steep: "3–5 minutes", note: "Black tea is more forgiving of fully boiling water than green or white tea." },
  oolong: { temp: "85–95°C (185–203°F)", steep: "3–5 minutes, often re-steeped 2–3 times", note: "Later infusions can usually run a little hotter and longer than the first." },
  white:  { temp: "75–80°C (167–176°F)", steep: "4–5 minutes", note: "The most delicate type here — err toward the cooler end and taste early." },
  herbal: { temp: "100°C (212°F), a full boil", steep: "5–7 minutes", note: "Herbal blends have no caffeine-driven bitterness risk, so a longer steep is safe." },
  coffee: { temp: "90.5–96.1°C (195–205°F)", steep: "SCA Golden Cup reference ratio: about 1:18 coffee to water by weight", note: "Below this range under-extracts (sour, thin); above it over-extracts (bitter, harsh)." },
};
const FLUORIDE_SAFE_LIMIT_MGL = 1.5;

function scoreParam(value, range) {
  if (value == null || Number.isNaN(value)) return null;
  const { lo, target, hi } = range;
  if (value < lo || value > hi) return { status: "out", pct: 0 };
  const span = value <= target ? (target - lo) : (hi - target);
  const dist = Math.abs(value - target);
  const pct = span === 0 ? 100 : Math.max(0, 100 - (dist / span) * 60);
  return { status: pct > 80 ? "ideal" : "ok", pct: Math.round(pct) };
}

function buildAdvice(input) {
  const profile = PROFILES[input.beverage];
  if (!profile) throw new Error(`Unknown beverage: ${input.beverage}`);
  const notes = [];
  const scores = {};
  let total = 0, count = 0;

  scores.ph = scoreParam(input.ph, profile.ph);
  scores.tds = scoreParam(input.tds, profile.tds);
  scores.hardness = scoreParam(input.hardness, profile.hardness);
  if (profile.alkalinity) scores.alkalinity = scoreParam(input.alkalinity, profile.alkalinity);
  for (const key in scores) if (scores[key]) { total += scores[key].pct; count++; }
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

function paramRow(labelText, value, unit, range, explain) {
  if (value == null || Number.isNaN(value)) return "";
  return `
    <div class="detail-row">
      <div class="detail-row-head">
        <span class="detail-label">${labelText}</span>
        <span class="detail-reading">${value}${unit} <span class="detail-ideal">(ideal ${range.lo}–${range.hi}${unit}, target ${range.target}${unit})</span></span>
      </div>
      <p class="detail-explain">${explain}</p>
    </div>`;
}

// Builds the long-form report shown only after payment: a summary, a
// deep-dive per water parameter (not just a one-line note), and general
// brewing guidance for the chosen beverage.
function buildDetailedReport(advice, input) {
  const p = advice.profile;
  const guide = BREW_GUIDANCE[input.beverage];

  const verdict = advice.overall >= 80
    ? `Your water is a strong match for ${p.label.toLowerCase()}. The chemistry is close enough to the golden ratio that you shouldn't need to change anything before brewing.`
    : advice.overall >= 50
    ? `Your water is a workable but imperfect match for ${p.label.toLowerCase()}. Nothing here will ruin the cup, but the notes below explain what's likely being held back and how to close the gap.`
    : `Your water is a poor match for ${p.label.toLowerCase()} as tested. That doesn't mean the water is unsafe — it means the mineral balance is far enough from the target range that it's actively working against the flavor you're trying to get. The breakdown below explains why, parameter by parameter, and what tends to fix each one.`;

  let html = `<p class="detail-summary">${verdict}</p>`;

  html += paramRow("pH — acidity / alkalinity", input.ph, "", p.ph,
    input.ph < p.ph.lo
      ? "Below the target range, water tends to pull a sharper, sometimes sour edge into the cup, because more of the acidic compounds in the leaf or grounds extract relative to the compounds that round out sweetness and body."
      : input.ph > p.ph.hi
      ? "Above the target range, water tends to flatten the cup and can add a soapy or metallic note, because alkaline water neutralizes some of the acids that give tea and coffee their brightness."
      : "This sits inside the favorable range, so pH is not expected to be limiting factor in how this brew tastes.");

  html += paramRow("TDS — Total Dissolved Solids", input.tds, " mg/L", p.tds,
    input.tds < p.tds.lo
      ? "Low TDS means there are few minerals in the water to carry flavor compounds, which often shows up as a thin or watery cup even with good leaf or grounds."
      : input.tds > p.tds.hi
      ? "High TDS means the water is already carrying a heavy mineral load before it touches the leaf or grounds, which can mute delicate aromatics and make the cup taste flat or dull."
      : "This sits inside the favorable range for extraction.");

  html += paramRow("Hardness (Calcium/Magnesium, as CaCO₃)", input.hardness, " mg/L", p.hardness,
    input.hardness > p.hardness.hi
      ? "High hardness both dulls flavor (excess magnesium in particular reads as metallic or chalky) and causes scale buildup in kettles over time."
      : input.hardness < p.hardness.lo
      ? "Low hardness under-extracts — the cup often tastes sour or thin because there isn't enough calcium to help pull sweetness and body out of the leaf or grounds."
      : "This sits inside the favorable range and should support good extraction.");

  if (p.alkalinity && input.alkalinity != null && !Number.isNaN(input.alkalinity)) {
    html += paramRow("Total Alkalinity (as CaCO₃)", input.alkalinity, " mg/L", p.alkalinity,
      input.alkalinity > p.alkalinity.hi
        ? "High alkalinity acts as a buffer against acidity, which can flatten the bright, fruity notes that make specialty coffee distinctive."
        : "This sits inside the favorable range for the SCA Golden Cup standard.");
  }

  if (input.fluoride != null && !Number.isNaN(input.fluoride)) {
    html += `<div class="detail-row"><div class="detail-row-head"><span class="detail-label">Fluoride</span><span class="detail-reading">${input.fluoride} mg/L</span></div>` +
      (input.fluoride > FLUORIDE_SAFE_LIMIT_MGL
        ? `<p class="detail-explain">⚠ This is above the WHO/KEBS drinking-water guideline of ${FLUORIDE_SAFE_LIMIT_MGL} mg/L. This is a health/safety flag, not a taste note — confirm with an accredited water-testing lab before regular use, especially for infant formula.</p>`
        : `<p class="detail-explain">This is within the WHO/KEBS guideline of ${FLUORIDE_SAFE_LIMIT_MGL} mg/L.</p>`) +
      `</div>`;
  }

  if (input.chlorine === true) {
    html += `<div class="detail-row"><div class="detail-row-head"><span class="detail-label">Chlorination</span><span class="detail-reading">Chlorinated tap water</span></div>` +
      `<p class="detail-explain">Residual chlorine or chloramine reacts with aromatic compounds and tends to mute delicate top notes well before the mineral content becomes the limiting factor. Letting the water stand uncovered for about 30 minutes, boiling and cooling it, or running it through a carbon filter will remove most of it.</p></div>`;
  }

  if (guide) {
    html += `
      <div class="brew-guide">
        <p class="brew-guide-title">General brewing guidance for ${p.label.toLowerCase()}</p>
        <p><strong>Water temperature:</strong> ${guide.temp}</p>
        <p><strong>Steep time:</strong> ${guide.steep}</p>
        <p>${guide.note}</p>
        <p class="hint">This is general published brewing practice, not a measurement of your water — adjust to taste.</p>
      </div>`;
  }

  return html;
}

function faceFor(pct) {
  if (pct == null) return "🙂";
  if (pct >= 80) return "😄";
  if (pct >= 50) return "🙂";
  return "😕";
}

// ---- UI wiring --------------------------------------------------------
let currentDrink = null;
let lastAdvice = null;
let lastInput = null;

const drinkBtns = document.querySelectorAll(".drink-btn");
const goldenCard = document.getElementById("golden-card");
const slidersPanel = document.getElementById("sliders-panel");
const alkalinityRow = document.getElementById("alkalinity-row");

const phEl = document.getElementById("ph");
const tdsEl = document.getElementById("tds");
const hardnessEl = document.getElementById("hardness");

function selectDrink(key) {
  currentDrink = key;
  drinkBtns.forEach(b => b.setAttribute("aria-pressed", b.dataset.drink === key ? "true" : "false"));
  const p = PROFILES[key];

  document.getElementById("golden-drink-name").textContent = `${p.emoji} ${p.label}`;
  document.getElementById("g-ph").textContent = p.ph.target.toFixed(1);
  document.getElementById("g-tds").textContent = p.tds.target;
  document.getElementById("g-hard").textContent = p.hardness.target;
  goldenCard.hidden = false;

  // reset dials to this drink's golden ratio
  phEl.value = p.ph.target;
  tdsEl.value = p.tds.target;
  hardnessEl.value = p.hardness.target;
  alkalinityRow.style.display = key === "coffee" ? "flex" : "none";
  updateReadouts();
  slidersPanel.hidden = false;
  document.getElementById("result").hidden = true;
  slidersPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

drinkBtns.forEach(btn => btn.addEventListener("click", () => selectDrink(btn.dataset.drink)));

function updateReadouts() {
  document.getElementById("ph-readout").textContent = parseFloat(phEl.value).toFixed(1);
  document.getElementById("tds-readout").textContent = tdsEl.value;
  document.getElementById("hardness-readout").textContent = hardnessEl.value;

  if (!currentDrink) return;
  const p = PROFILES[currentDrink];
  const phScore = scoreParam(parseFloat(phEl.value), p.ph);
  const tdsScore = scoreParam(parseFloat(tdsEl.value), p.tds);
  const hardScore = scoreParam(parseFloat(hardnessEl.value), p.hardness);
  document.getElementById("ph-face").textContent = `${faceFor(phScore?.pct)} ${phScore?.pct >= 80 ? "Just right" : phScore?.pct >= 50 ? "Close" : "Off"}`;
  document.getElementById("tds-face").textContent = `${faceFor(tdsScore?.pct)} ${tdsScore?.pct >= 80 ? "Just right" : tdsScore?.pct >= 50 ? "Close" : "Off"}`;
  document.getElementById("hardness-face").textContent = `${faceFor(hardScore?.pct)} ${hardScore?.pct >= 80 ? "Just right" : hardScore?.pct >= 50 ? "Close" : "Off"}`;
}

[phEl, tdsEl, hardnessEl].forEach(el => el.addEventListener("input", updateReadouts));

document.getElementById("check-btn").addEventListener("click", () => {
  const alkalinity = document.getElementById("alkalinity").value;
  const fluoride = document.getElementById("fluoride").value;
  const input = {
    beverage: currentDrink,
    ph: parseFloat(phEl.value),
    tds: parseFloat(tdsEl.value),
    hardness: parseFloat(hardnessEl.value),
    alkalinity: alkalinity ? parseFloat(alkalinity) : null,
    fluoride: fluoride ? parseFloat(fluoride) : null,
    chlorine: document.getElementById("chlorine").checked,
  };
  lastInput = input;
  lastAdvice = buildAdvice(input);

  const result = document.getElementById("result");
  result.hidden = false;
  document.getElementById("result-unlocked").hidden = true;
  document.getElementById("result-locked").hidden = false;
  document.getElementById("teaser-face").textContent = faceFor(lastAdvice.overall);
  document.getElementById("teaser-pct").textContent = lastAdvice.overall ?? "\u2014";
  document.getElementById("teaser-note").textContent = lastAdvice.notes[0] || "";
  document.getElementById("paid-btn").disabled = true;
  result.scrollIntoView({ behavior: "smooth", block: "start" });
  setUpPayment();
});

// ---- Payment: a plain PayPal.me link, no backend involved ---------------
// There is no server here to verify payment automatically. Instead, the
// unlocked report itself asks the buyer to email proof of payment to
// belltowerkenya@gmail.com \u2014 a real human check, not an automated one.
function setUpPayment() {
  const link = window.TWA_CONFIG?.payPalLink;
  const priceLabel = window.TWA_CONFIG?.priceLabel || "";
  const payLink = document.getElementById("pay-link");
  const paidBtn = document.getElementById("paid-btn");
  const priceEl = document.getElementById("price-label");

  const notConfigured = !link || link.includes("YOUR-PAYPAL");
  priceEl.textContent = notConfigured
    ? "Payments aren't set up on this site yet."
    : `Unlock the full report \u2014 ${priceLabel}`;

  if (notConfigured) {
    payLink.setAttribute("aria-disabled", "true");
    payLink.href = "#";
    return;
  }

  payLink.href = link;

  payLink.addEventListener("click", () => {
    paidBtn.disabled = false;
  }, { once: true });
}

document.getElementById("paid-btn").addEventListener("click", () => {
  renderFullReport(lastAdvice, lastInput);
});

function renderFullReport(advice, input) {
  const result = document.getElementById("result");
  result.hidden = false;
  document.getElementById("result-locked").hidden = true;
  document.getElementById("result-unlocked").hidden = false;
  document.getElementById("full-face").textContent = faceFor(advice.overall);
  document.getElementById("overall-pct").textContent = advice.overall ?? "\u2014";

  const email = window.TWA_CONFIG?.verificationEmail || "belltowerkenya@gmail.com";
  const emailLink = document.getElementById("verify-email-link");
  emailLink.textContent = email;
  emailLink.href = `mailto:${email}?subject=${encodeURIComponent("Payment verification - " + advice.profile.label + " report")}`;

  document.getElementById("detailed-report").innerHTML = buildDetailedReport(advice, input);

  const list = document.getElementById("notes-list");
  list.innerHTML = "";
  advice.notes.forEach(n => {
    const li = document.createElement("li");
    li.textContent = n;
    list.appendChild(li);
  });
  result.scrollIntoView({ behavior: "smooth", block: "start" });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
}
