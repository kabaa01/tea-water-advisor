# Steep & Standard — Tea & Coffee Brewing Water Advisor

A Progressive Web App (PWA — a website that can be installed like an app
and works offline) that takes a water test result (pH, TDS, hardness,
fluoride) and gives a brew-specific reading of how that water will affect
taste, with a paid unlock for the full breakdown via PayPal. Free teaser
(overall percentage match + one note) is open; the full report requires a
one-time PayPal payment.

## What this is / is not

- **Is:** a scoring tool built from published brewing-water research (see
  Sources below), giving an *estimate* of likely taste impact.
- **Is not:** a certified water-safety test, a medical/health tool, or a
  claim that works for "any food" — it's scoped to tea and coffee, where the
  water-chemistry-to-taste link is actually documented. The fluoride check is
  a safety flag pointing to a proper lab test, not a diagnosis.

## Glossary

Acronyms and abbreviations used throughout this document and the app:

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
| API | Application Programming Interface — how software services talk to each other |
| REST | Representational State Transfer — a common style of web API |
| SDK | Software Development Kit — a vendor's ready-made code library (here, PayPal's) |
| JSON | JavaScript Object Notation — a text format for structured data |
| YAML | "YAML Ain't Markup Language" — a text format used for configuration files |
| DOM | Document Object Model — the browser's in-memory representation of a web page |
| CORS | Cross-Origin Resource Sharing — browser security rules for cross-site requests |
| JWT | JSON Web Token — a signed token format (used here for Google's service-account auth) |
| HMAC | Hash-based Message Authentication Code — a way to sign and verify data |
| CI | Continuous Integration — automatically running tests on every code change |
| PCI-DSS | Payment Card Industry Data Security Standard — card-data handling rules (PayPal/Stripe absorb this for you) |

## Payment: PayPal

Payments are processed through PayPal's Orders API and settle into whichever
PayPal account owns the API credentials you configure. Your account login
email (`kabaa01@yahoo.com`) is not itself a code setting — the code
authenticates with a **Client ID** and **Client Secret** generated for that
account, which is what actually determines where funds land.

### One-time setup

1. Go to **developer.paypal.com** and log in with `kabaa01@yahoo.com`
   (create/upgrade to a PayPal **Business** account if you haven't — required
   to receive payments).
2. **Apps & Credentials → Create App** (Default/Live app is fine).
3. Copy the **Client ID** and **Secret** it gives you.
4. Put the Client ID in two places (it's public, safe to expose):
   - `config.js` → `paypalClientId`
   - `worker/wrangler.toml` → `PAYPAL_CLIENT_ID` under `[vars]`
5. Put the Secret in **one** place, as a real secret (never in a file you
   commit): `npx wrangler secret put PAYPAL_CLIENT_SECRET` (see deploy steps
   below).
6. (Optional but recommended) **Apps & Credentials → your app → Add
   Webhook**, URL = `https://<your-worker>.workers.dev/webhook`, event =
   `Payment capture completed`. Copy the Webhook ID into
   `wrangler secret put PAYPAL_WEBHOOK_ID`. Without this, payments still work
   — you just lose server-side signature verification on the webhook.
7. Test with a **sandbox** app first (`PAYPAL_MODE = "sandbox"` in
   `wrangler.toml`, and use sandbox Client ID/Secret) before switching to
   `"live"`.

## What changed in this version

- **Payment processor switched from Stripe to PayPal.** No redirect —
  PayPal's button renders inline and completes in a popup.
- **Price now reads from the Worker, not hardcoded in the page.** Change
  `PRICE_USD_CENTS` once in `worker/wrangler.toml`; the page fetches
  `/price` and displays it automatically. See "Deploying a price change"
  below.
- **Admin link removed from the public site.** It wasn't necessary — PayPal's
  own Dashboard already shows every payment with receipts and export, and
  Sheets logging is optional (see below). `admin.html` still exists in the
  repo for direct-URL access if you ever want the custom dashboard; it's
  just not linked anywhere a visitor would find it.
- **"Grown-up settings" renamed** to "Additional water parameters (optional)".
- **Glossary added**, in-app and in this README, explaining every acronym.
- **One config file, not two.** `config.js` is the only place the Worker URL
  and PayPal Client ID live. Both `index.html` and `admin.html` read from it.
- **Fixed a real deploy bug:** every asset reference used to start with `/`
  (absolute root path), which breaks on GitHub Pages project sites (served
  from a subfolder, not the root). Everything now uses relative paths, and
  `tests/paths.test.mjs` fails the build if this regresses.
- **Two GitHub Actions workflows**, in `.github/workflows/`:
  - `test.yml` — runs the full automated test suite on every push/PR.
  - `deploy-worker.yml` — deploys the Cloudflare Worker automatically
    whenever files under `worker/` change (including price changes).
- **`scripts/check-ready.mjs`** — run `node scripts/check-ready.mjs` any
  time to see exactly what's still missing before going live.

## Architecture

```
Browser (PWA)                Cloudflare Worker              External
─────────────                ─────────────────              ────────
index.html/app.js  ───POST──▶ /create-order            ───▶ PayPal API
                    ◀──id────
   (PayPal button renders inline, user pays in a popup)
                    ───POST──▶ /capture-order            ───▶ PayPal API
                    ◀─status─
                    ───GET───▶ /price                    (reads PRICE_USD_CENTS)

PayPal             ───POST webhook──▶ /webhook  ──append row──▶ Google Sheets
                                                  (optional, source of truth for logging)

admin.html          ───POST──▶ /admin/login  (password → signed session token)
                     ───GET───▶ /admin/transactions (reads Google Sheet, if configured)
```

GitHub Pages hosts the static frontend (`index.html`, `app.js`, `config.js`,
`styles.css`, `admin.html`, `manifest.json`, `sw.js`). It cannot run server
code or hold secrets, so the Worker is a separate, small backend on
Cloudflare's free tier.

## Do you need Google Sheets?

No. It only powers the optional `admin.html` dashboard. PayPal's own
Dashboard already shows every payment with receipts and export — skip
Sheets entirely unless you specifically want the custom view.

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
npx wrangler secret put PAYPAL_CLIENT_SECRET
npx wrangler secret put PAYPAL_WEBHOOK_ID       # optional
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put ADMIN_TOKEN_SECRET      # any long random string
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT  # optional — only if using Sheets
npx wrangler secret put GOOGLE_SHEET_ID         # optional — only if using Sheets
npx wrangler deploy
```

After deploying, copy your Worker URL (`https://tea-water-advisor.<you>.workers.dev`)
into `config.js` — replace `YOUR-SUBDOMAIN`, and set `paypalClientId` there
too. That's the only frontend file that needs it. Run
`node scripts/check-ready.mjs` to confirm nothing's missing. Update
`worker/wrangler.toml`'s `ALLOWED_ORIGIN`/`SITE_URL` to your actual GitHub
Pages URL and `PAYPAL_CLIENT_ID` to match `config.js`, then `wrangler deploy`
again (or just push — `deploy-worker.yml` does it for you if set up).

## Deploying a price change (e.g. you just edited PRICE_USD_CENTS)

The price lives in exactly one place: `worker/wrangler.toml` → `PRICE_USD_CENTS`
under `[vars]`. The frontend always reads the current value from the Worker
at `/price` — you never edit a price in the HTML/JS.

**If you've set up the automated deploy** (`CLOUDFLARE_API_TOKEN` secret
added in GitHub, see below): just commit and push.
```powershell
cd "C:\Users\John Kamau\Desktop\tea-water-advisor"
git add worker/wrangler.toml
git commit -m "Update price to 500 cents"
git push
```
The `deploy-worker.yml` Action detects the change under `worker/` and
redeploys automatically — check the "Actions" tab on GitHub for progress.

**If you haven't set up automated deploy yet**, deploy manually:
```powershell
cd "C:\Users\John Kamau\Desktop\tea-water-advisor\worker"
npx wrangler deploy
```
Either way, no other file needs touching, and the frontend picks up the new
price automatically the next time someone loads the page — no cache to
clear on your end.

## Enabling the automated Worker deploy (optional but recommended)

1. In the Cloudflare dashboard: **My Profile → API Tokens → Create Token**
   → use the "Edit Cloudflare Workers" template → copy the token.
2. In your GitHub repo: **Settings → Secrets and variables → Actions →
   New repository secret** → name it `CLOUDFLARE_API_TOKEN`, paste the value.
3. From then on, any push to `main` that touches `worker/` (including a
   price change in `wrangler.toml`) auto-deploys.

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

Automated (re-run anytime with `node --test tests/*.mjs` from the repo
root, and automatically on every push via `.github/workflows/test.yml`):

- 10 scoring-engine tests (ideal/bad water, boundary handling, missing
  fields, fluoride/chlorine flags, invalid beverage, all profiles reachable,
  percentages always 0–100).
- 1 path-regression test: fails the build if any local asset reference uses
  an absolute root path again (the bug that broke the first deploy).
- 4 config tests: no admin link on the public page, both HTML files load
  `config.js`, no duplicated hardcoded Worker URLs outside `config.js`,
  `admin.html` still exists as a direct-URL page.

Static checks re-run on every change: JSON validity (`manifest.json`,
`worker/package.json`), JS syntax (`app.js`, `config.js`,
`worker/src/index.js`), GitHub Actions YAML validity, every DOM id
referenced in `app.js` matching one defined in `index.html`, HTML tag
balance, and a full-text search confirming no leftover Stripe or
"grown-up" references anywhere in the codebase. All checks passed on
three consecutive runs of this version.

**Not automated — still needs your pass**, because these require a live
browser/device or real PayPal/GitHub accounts:
- A real PayPal sandbox payment end-to-end (button → capture → unlock).
- Lighthouse/PWA audit (installability, offline behavior) in Chrome DevTools.
- Screen-reader pass and keyboard-only navigation.
- Mobile Safari/Chrome visual check.

I ran every check I could actually execute rather than claim an open-ended
"repeat until zero issues" loop in the abstract — that phrase only means
something against a live environment. Once you deploy, tell me what breaks
and I'll reproduce, patch, and re-test the same way.
