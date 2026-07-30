/* ==========================================================================
   Tea & Coffee Brewing Water Advisor — UI wiring (browser only)
   Scoring logic lives in scoring.mjs so it can be unit-tested in Node
   without a DOM. Every threshold used there is sourced — see README.
   This model estimates likely taste impact from water chemistry.
   It is NOT a lab-certified taste prediction and does not diagnose
   water safety — pair it with an accredited water test for potability.
   ========================================================================== */
import { buildAdvice } from "./scoring.mjs";

// ---- UI wiring ------------------------------------------------------------
const els = {
  form: document.getElementById("advisor-form"),
  beverage: document.getElementById("beverage"),
  ph: document.getElementById("ph"),
  tds: document.getElementById("tds"),
  hardness: document.getElementById("hardness"),
  alkalinityRow: document.getElementById("alkalinity-row"),
  alkalinity: document.getElementById("alkalinity"),
  fluoride: document.getElementById("fluoride"),
  chlorine: document.getElementById("chlorine"),
  swatch: document.getElementById("infusion-swatch"),
  result: document.getElementById("result"),
  resultLocked: document.getElementById("result-locked"),
  resultUnlocked: document.getElementById("result-unlocked"),
  payBtn: document.getElementById("pay-btn"),
  overallPct: document.getElementById("overall-pct"),
  notesList: document.getElementById("notes-list"),
};

const WORKER_BASE = window.TWA_CONFIG?.workerBase || "https://tea-water-advisor.YOUR-SUBDOMAIN.workers.dev";

function updateSwatch() {
  // Signature element: infusion color shifts live with pH + hardness,
  // reflecting the cited color/brightness research (higher pH & mineral
  // content -> darker, duller infusion; lower pH -> brighter, lighter).
  const ph = parseFloat(els.ph.value) || 7;
  const hardness = parseFloat(els.hardness.value) || 68;
  const lightness = Math.max(28, Math.min(62, 62 - (ph - 6.5) * 14 - (hardness / 85) * 10));
  const hue = 30; // amber/liquor hue
  const sat = 55 + Math.min(20, hardness / 10);
  els.swatch.style.background = `hsl(${hue} ${sat}% ${lightness}%)`;
}

els.beverage.addEventListener("change", () => {
  els.alkalinityRow.style.display = els.beverage.value === "coffee" ? "flex" : "none";
});
[els.ph, els.hardness].forEach(el => el.addEventListener("input", updateSwatch));
updateSwatch();

let lastAdvice = null;

els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = {
    beverage: els.beverage.value,
    ph: parseFloat(els.ph.value),
    tds: parseFloat(els.tds.value),
    hardness: parseFloat(els.hardness.value),
    alkalinity: els.alkalinity.value ? parseFloat(els.alkalinity.value) : null,
    fluoride: els.fluoride.value ? parseFloat(els.fluoride.value) : null,
    chlorine: els.chlorine.checked,
  };
  lastAdvice = buildAdvice(input);

  // Free teaser: overall % + first note only. Full breakdown is paywalled.
  els.result.hidden = false;
  els.resultUnlocked.hidden = true;
  els.resultLocked.hidden = false;
  document.getElementById("teaser-pct").textContent = lastAdvice.overall ?? "—";
  document.getElementById("teaser-note").textContent = lastAdvice.notes[0] || "";
  els.result.scrollIntoView({ behavior: "smooth", block: "start" });
});

els.payBtn.addEventListener("click", async () => {
  els.payBtn.disabled = true;
  els.payBtn.textContent = "Redirecting to secure checkout…";
  try {
    const res = await fetch(`${WORKER_BASE}/create-checkout-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ beverage: lastAdvice.profile.label }),
    });
    const data = await res.json();
    if (data.url) {
      sessionStorage.setItem("twa_pending_input", JSON.stringify(lastAdvice));
      window.location.href = data.url;
    } else {
      throw new Error(data.error || "Could not start checkout");
    }
  } catch (err) {
    els.payBtn.textContent = "Unlock full brew report — try again";
    els.payBtn.disabled = false;
    alert("Payment could not start: " + err.message);
  }
});

// On return from Stripe Checkout (?session_id=...), verify and unlock.
async function checkReturnFromCheckout() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session_id");
  if (!sessionId) return;
  const res = await fetch(`${WORKER_BASE}/verify?session_id=${encodeURIComponent(sessionId)}`);
  const data = await res.json();
  if (data.paid) {
    const stored = sessionStorage.getItem("twa_pending_input");
    if (stored) {
      lastAdvice = JSON.parse(stored);
      renderFullReport(lastAdvice);
    }
  }
  window.history.replaceState({}, "", window.location.pathname);
}

function renderFullReport(advice) {
  els.result.hidden = false;
  els.resultLocked.hidden = true;
  els.resultUnlocked.hidden = false;
  els.overallPct.textContent = advice.overall ?? "—";
  els.notesList.innerHTML = "";
  advice.notes.forEach(n => {
    const li = document.createElement("li");
    li.textContent = n;
    els.notesList.appendChild(li);
  });
}

checkReturnFromCheckout();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js"));
}
