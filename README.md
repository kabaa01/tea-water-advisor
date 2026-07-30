# Steep & Standard — Tea & Coffee Brewing Water Advisor

A PWA that takes a water test result (pH, TDS, hardness, fluoride) and gives a
brew-specific reading of how that water will affect taste, with a paid unlock
for the full breakdown. Free teaser (overall % + one note) is open; the full
report requires a one-time Stripe payment.

## What this is / is not

- **Is:** a scoring tool built from published brewing-water research (see
  Sources below), giving an *estimate* of likely taste impact.
- **Is not:** a certified water-safety test, a medical/health tool, or a
  claim that works for "any food" — it's scoped to tea and coffee, where the
  water-chemistry-to-taste link is actually documented. The fluoride check is
  a safety flag pointing you to a real lab, not a diagnosis.

## Architecture

```
Browser (PWA)                Cloudflare Worker              External
─────────────                ─────────────────              ────────
index.html/app.js  ───POST──▶ /create-checkout-session ───▶ Stripe API
                    ◀──url───
   (redirect to Stripe Checkout, user pays)
                    ───GET───▶ /verify?session_id=...   ───▶ Stripe API
                    ◀──paid──

Stripe            ───POST webhook──▶ /webhook  ──append row──▶ Google Sheets
                                                  (source of truth for logging)

admin.html         ───POST──▶ /admin/login  (password → signed session token)
                    ───GET───▶ /admin/transactions (reads Google Sheet)
```

GitHub Pages hosts the static frontend (`index.html`, `app.js`, `scoring.mjs`,
`styles.css`, `admin.html`, `manifest.json`, `sw.js`). It cannot run server
code or hold secrets, so the Worker is a separate, small backend on
Cloudflare's free tier. Both are yours; nothing routes through a third party
beyond Stripe and Google.

## What you need to set up yourself (I can't do these for you)

1. **A Stripe account** (stripe.com) linked to your US bank account —
   that linking happens entirely on Stripe's site under your login.
   Get your **Secret key** and, after creating a webhook endpoint pointing
   at `https://<your-worker>.workers.dev/webhook` for the
   `checkout.session.completed` event, your **webhook signing secret**.
2. **A Google Cloud service account** with the Sheets API enabled. Download
   its JSON key. Create a Google Sheet with a tab named `Transactions` and
   header row `Date | Beverage | Amount | Status`, then share that sheet with
   the service account's email (Editor access).
3. **A Cloudflare account** (free tier is enough) to deploy the Worker.
4. **A GitHub repo** under `kabaa01` (e.g. `kabaa01/tea-water-advisor`) to
   host the frontend via GitHub Pages.

## Deploy steps

```bash
# 1. Frontend — push this repo to GitHub, then enable Pages
git init
git remote add origin https://github.com/kabaa01/tea-water-advisor.git
git add .
git commit -m "Initial commit"
git push -u origin main
# GitHub → Settings → Pages → deploy from "main" branch, root folder

# 2. Backend — deploy the Worker
cd worker
npm install
npx wrangler login
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put ADMIN_TOKEN_SECRET      # any long random string
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT  # paste the whole JSON key file contents
npx wrangler secret put GOOGLE_SHEET_ID         # the ID from the sheet's URL
npx wrangler deploy
```

After deploying, copy your Worker URL (`https://tea-water-advisor.<you>.workers.dev`)
into the two places that currently say `YOUR-SUBDOMAIN`:
`index.html` (inline `TWA_CONFIG`) and `admin.html` (`WORKER_BASE`). Also
update `worker/wrangler.toml`'s `ALLOWED_ORIGIN` and `SITE_URL` to your actual
GitHub Pages URL, then `wrangler deploy` again.

Add real icon files at `icons/icon-192.png` and `icons/icon-512.png`
(placeholders are not included — any square PNG works for testing).

## Sources for the scoring thresholds

- Tea pH/TDS/hardness targets and their taste effects: brewing-water studies
  on catechin extraction and infusion color (e.g. *ScienceDirect*, "The types
  of brewing water affect tea infusion flavor by changing the tea mineral
  dissolution," 2023; "Effects of different types of water on the sensory
  and physicochemical properties of cold-brewed green tea," 2026).
- Coffee targets: Specialty Coffee Association (SCAA/SCA) Golden Cup water
  standard (TDS 150 mg/L target, 75–250 range; calcium hardness 68 mg/L
  target, 17–85 range; alkalinity ~40 mg/L; pH 7.0, 6.5–7.5 range).
- Fluoride guideline: WHO drinking-water guideline / KEBS standard, 1.5 mg/L.

These are general reference ranges, not a substitute for an accredited lab
report — the in-app copy says this, and so does this file.

## QA performed

Automated (re-run anytime with `cd tests && node --test scoring.test.mjs`
from the repo root, or `node --test tests/scoring.test.mjs`):

- 10 unit tests covering: ideal-water scoring, badly-out-of-range scoring,
  boundary/out-of-range input handling, missing optional fields, the
  fluoride safety flag firing/not-firing correctly, the chlorine note,
  invalid beverage type raising a clear error instead of failing silently,
  all six beverage profiles being reachable, and score percentages always
  staying within 0–100.
- Static checks: every DOM id referenced in `app.js`/`admin.html` matches an
  id that exists in `index.html`/`admin.html`; `manifest.json` and
  `worker/package.json` parse as valid JSON; `worker/src/index.js` and
  `app.js` pass a Node syntax check; HTML structural tags are balanced.
- All of the above passed on the version in this repo — 10/10 tests green,
  zero mismatches found.

**Not automated — needs your pass before going live**, because these
require a real browser/device or a live Stripe/Google account, which I don't
have access to:
- Lighthouse/PWA audit (installability, offline behavior) in Chrome DevTools.
- Real Stripe test-mode payment end-to-end (checkout → webhook → Sheet row
  → admin dashboard shows it).
- Screen-reader pass and keyboard-only navigation.
- Mobile Safari/Chrome visual check (this repo includes responsive CSS and a
  `prefers-reduced-motion` fallback, but only a real device confirms it).

I ran the checks I could actually execute rather than claim an open-ended
"repeat until zero issues" loop — that phrase isn't meaningful without a
live environment to test against. Once you deploy Worker + Pages, tell me
what breaks and I'll fix it in the same way: reproduce, patch, re-test.
