# Steep & Standard — Tea & Coffee Brewing Water Advisor

A Progressive Web App (PWA — a website that can be installed like an app
and works offline) that takes a water test result (pH, TDS, hardness,
fluoride) and gives a brew-specific reading of how that water will affect
taste, with a paid unlock for the full breakdown via a plain PayPal
payment link. No servers, no accounts beyond GitHub and PayPal, nothing
to configure with a command line.

## What this is / is not

- **Is:** a scoring tool built from published brewing-water research (see
  Sources below), giving an *estimate* of likely taste impact.
- **Is not:** a certified water-safety test, a medical/health tool, or a
  claim that works for "any food" — it's scoped to tea and coffee, where the
  water-chemistry-to-taste link is actually documented. The fluoride check is
  a safety flag pointing to a proper lab test, not a diagnosis.

## Glossary

| Term | Meaning |
|---|---|
| pH | Potential of Hydrogen — acidity/alkalinity, scale 0–14 |
| TDS | Total Dissolved Solids — mineral content of water |
| mg/L | Milligrams per Litre — a unit of concentration |
| CaCO₃ | Calcium Carbonate — reference compound for hardness/alkalinity |
| SCA | Specialty Coffee Association — publishes coffee water standards |
| WHO | World Health Organization |
| KEBS | Kenya Bureau of Standards |
| PWA | Progressive Web App |
| CI | Continuous Integration — automatically running tests on every code change |

## How payment works

There is no backend. The "Pay with PayPal" button is a plain link to your
**PayPal.me** page with the price built into the URL. When someone clicks
it, PayPal opens in a new tab and they pay you directly — funds land in
your PayPal account (`kabaa01@yahoo.com`) immediately.

**Verification is a real human check, not an automated one.** After
paying, the buyer clicks "Show my report" to reveal it immediately (no
gate beyond having clicked the pay link). Inside the unlocked report is a
short, plainly-worded box asking them to email proof of payment — a
screenshot of the PayPal receipt or the Transaction ID — to
**belltowerkenya@gmail.com**, along with their name and the date. That
email is what you personally check, rather than any code checking PayPal
on your behalf. This intentionally trades automatic verification for
zero backend complexity and puts you in control of confirming payments
yourself.

If you ever want real *automatic* verification again (PayPal itself
confirming the charge before the report unlocks), that requires a small
server-side piece — ask and I'll scope the minimal version.

### One-time setup (5 minutes, no technical steps)

1. Log into PayPal as `kabaa01@yahoo.com`.
2. Go to **paypal.com/paypalme** and claim a link name (e.g. `paypal.me/kabaa01`).
3. Open `config.js` in this project and set:
   ```js
   payPalLink: "https://paypal.me/kabaa01/5USD",
   priceLabel: "$5.00",
   verificationEmail: "belltowerkenya@gmail.com",
   ```
   (Replace `kabaa01` with whatever name you actually claimed, and `5USD`
   with your price — the number is the amount, `USD` fixes the currency
   so it doesn't default to something else.)
4. Save, then push to GitHub (see Deploy steps below).

That's the entire payment setup. No API keys, no secrets, no CLI.

## Deploy steps

```bash
git add .
git commit -m "Add manual payment verification and detailed report"
git push
```

GitHub Pages picks it up automatically within a minute or two. There is
nothing else to run, configure, or deploy. `.github/workflows/test.yml`
runs the automated tests on every push automatically; it needs no secrets.

## Changing the price later

Open `config.js`, change both the amount in `payPalLink` and `priceLabel`
to match, save, commit, push. That's the whole process.

## The detailed report

Once unlocked, the report goes well beyond the free teaser: a plain-
English summary paragraph, a full breakdown of every tested parameter
(your reading, the ideal range, and a real explanation of what it's
doing to the cup — not just a one-line note), a fluoride/chlorine safety
callout when relevant, and general brewing guidance (water temperature
and steep time) for the chosen beverage, sourced from widely published
brewing practice and the SCA Golden Cup standard for coffee.

## Sources for the scoring thresholds

- Tea pH/TDS/hardness targets and their taste effects: brewing-water studies
  on catechin extraction and infusion color (e.g. *ScienceDirect*, "The types
  of brewing water affect tea infusion flavor by changing the tea mineral
  dissolution," 2023; "Effects of different types of water on the sensory
  and physicochemical properties of cold-brewed green tea," 2026).
- Coffee targets: Specialty Coffee Association (SCA) Golden Cup water
  standard (TDS 150 mg/L target, 75–250 range; calcium hardness 68 mg/L
  target, 17–85 range; alkalinity ~40 mg/L; pH 7.0, 6.5–7.5 range).
- Fluoride guideline: World Health Organization (WHO) drinking-water
  guideline / Kenya Bureau of Standards (KEBS), 1.5 mg/L.

These are general reference ranges, not a substitute for an accredited lab
report — the in-app copy says this, and so does this file.

## QA performed

Automated (re-run anytime with `node --test tests/*.mjs`, and automatically
on every push via `.github/workflows/test.yml`):

- 10 scoring-engine tests (ideal/bad water, boundary handling, missing
  fields, fluoride/chlorine flags, invalid beverage, all profiles reachable,
  percentages always 0–100).
- 1 path-regression test (fails the build if any asset reference breaks on
  GitHub Pages again).
- 9 tests covering the manual-verification payment setup: no automated
  backend/API code remains anywhere, `config.js` exposes only non-secret
  values including the verification email, the verify-by-email step lives
  inside the unlocked report (not gating access to it) and stays brief
  (2–5 steps), the pay gate is two simple steps with no false
  auto-verification claim, and the detailed report actually covers every
  tested parameter with a real explanation plus brewing guidance for all
  six beverages.

Static checks re-run on every change: JSON validity, JS syntax, GitHub
Actions YAML validity, every DOM id referenced in `app.js` matching one
defined in `index.html`, and HTML tag balance including the new report
markup (`<ol>`/`<li>`/extra `<a>` for the mailto link). A functional
smoke test also ran `buildDetailedReport()` directly in Node against
several real inputs (ideal coffee water, and bad green-tea water with a
fluoride flag and chlorine both present) to confirm it produces real
content in every branch, not just that the function exists. All checks
passed on three consecutive full runs of this version.

**Not automated — still needs your pass**, because these require a real
browser/device or an actual PayPal payment:
- Clicking "Pay with PayPal" and confirming it opens your real PayPal.me
  page with the right amount pre-filled.
- Confirming the `mailto:` verification link opens your email client with
  the right address and subject pre-filled.
- Lighthouse/PWA audit (installability, offline behavior) in Chrome DevTools.
- Screen-reader pass and keyboard-only navigation.
- Mobile Safari/Chrome visual check.

I ran every check I could actually execute rather than claim an open-ended
"repeat until zero issues" loop in the abstract — that phrase only means
something against a live environment. Once you deploy, tell me what you
see and I'll fix anything that's off.
