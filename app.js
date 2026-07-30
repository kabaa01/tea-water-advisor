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

function faceFor(pct) {
  if (pct == null) return "🙂";
  if (pct >= 80) return "😄";
  if (pct >= 50) return "🙂";
  return "😕";
}

// ---- UI wiring --------------------------------------------------------
const WORKER_BASE = window.TWA_CONFIG?.workerBase || "https://tea-water-advisor.YOUR-SUBDOMAIN.workers.dev";
let currentDrink = null;
let lastAdvice = null;

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
  lastAdvice = buildAdvice(input);

  const result = document.getElementById("result");
  result.hidden = false;
  document.getElementById("result-unlocked").hidden = true;
  document.getElementById("result-locked").hidden = false;
  document.getElementById("teaser-face").textContent = faceFor(lastAdvice.overall);
  document.getElementById("teaser-pct").textContent = lastAdvice.overall ?? "—";
  document.getElementById("teaser-note").textContent = lastAdvice.notes[0] || "";
  result.scrollIntoView({ behavior: "smooth", block: "start" });
  setUpPayment();
});

// ---- PayPal payment (dynamic: price and buttons load from the Worker) ----
let paymentReady = false;

async function fetchPrice() {
  try {
    const res = await fetch(`${WORKER_BASE}/price`);
    const data = await res.json();
    const dollars = ((data.cents || 500) / 100).toFixed(2);
    document.getElementById("price-label").textContent = `Unlock the full report — $${dollars}`;
  } catch {
    document.getElementById("price-label").textContent = "Unlock the full report for a one-time fee.";
  }
}

function loadPayPalSdk(clientId) {
  return new Promise((resolve, reject) => {
    if (window.paypal) { resolve(window.paypal); return; }
    const s = document.createElement("script");
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD`;
    s.onload = () => resolve(window.paypal);
    s.onerror = () => reject(new Error("Could not load PayPal"));
    document.head.appendChild(s);
  });
}

async function setUpPayment() {
  fetchPrice();
  if (paymentReady) return; // buttons only need to be rendered once

  const clientId = window.TWA_CONFIG?.paypalClientId;
  const notConfigured = !WORKER_BASE || WORKER_BASE.includes("YOUR-SUBDOMAIN") ||
    !clientId || clientId === "YOUR_PAYPAL_CLIENT_ID";
  if (notConfigured) {
    document.getElementById("paypal-button-container").textContent =
      "Payments aren't set up on this site yet — the site owner needs to add PayPal credentials.";
    return;
  }

  try {
    const paypal = await loadPayPalSdk(clientId);
    paypal.Buttons({
      createOrder: async () => {
        const res = await fetch(`${WORKER_BASE}/create-order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ beverage: lastAdvice.profile.label }),
        });
        const data = await res.json();
        if (!data.id) throw new Error(data.error || "Could not start payment");
        return data.id;
      },
      onApprove: async (data) => {
        const res = await fetch(`${WORKER_BASE}/capture-order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderID: data.orderID }),
        });
        const result = await res.json();
        if (result.status === "COMPLETED") {
          renderFullReport(lastAdvice);
        } else {
          alert("Payment could not be completed. Please try again.");
        }
      },
      onError: (err) => {
        alert("PayPal error: " + (err?.message || "please try again."));
      },
    }).render("#paypal-button-container");
    paymentReady = true;
  } catch (err) {
    document.getElementById("paypal-button-container").textContent =
      "PayPal could not load. Please refresh and try again.";
  }
}

function renderFullReport(advice) {
  const result = document.getElementById("result");
  result.hidden = false;
  document.getElementById("result-locked").hidden = true;
  document.getElementById("result-unlocked").hidden = false;
  document.getElementById("full-face").textContent = faceFor(advice.overall);
  document.getElementById("overall-pct").textContent = advice.overall ?? "—";
  const list = document.getElementById("notes-list");
  list.innerHTML = "";
  advice.notes.forEach(n => {
    const li = document.createElement("li");
    li.textContent = n;
    list.appendChild(li);
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
}
