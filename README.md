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

## How payment works (the simple version)

There is no backend. The "Pay with PayPal" button is a plain link to your
**PayPal.me** page with the price built into the URL. When someone clicks
it, PayPal opens in a new tab and they pay you directly — funds land in
your PayPal account (`kabaa01@yahoo.com`) immediately, the same as if
you'd texted them the link yourself.

**The honest trade-off:** because there's no server, this page can't
automatically confirm a payment happened. After paying, the buyer clicks
"I've paid — show my report" themselves to reveal it. PayPal always sends
a real receipt by email to both you and the buyer automatically — that
email is the actual proof of payment, and it requires no setup on your
part. For a low-cost digital report like this, that's a completely normal
approach; it trades a small amount of trust for zero technical complexity.
If you ever want real automatic verification, that requires the backend
approach we removed — let me know if you want it back for a specific
reason and I can re-add just that piece.

### One-time setup (5 minutes, no technical steps)

1. Log into PayPal as `kabaa01@yahoo.com`.
2. Go to **paypal.com/paypalme** and claim a link name (e.g. `paypal.me/kabaa01`).
3. Open `config.js` in this project and set:
   ```js
   payPalLink: "https://paypal.me/kabaa01/5USD",
   priceLabel: "$5.00",
   ```
   (Replace `kabaa01` with whatever name you actually claimed, and `5USD`
   with your price — the number is the amount, `USD` fixes the currency
   so it doesn't default to something else.)
4. Save, then push to GitHub (see Deploy steps below).

That's the entire payment setup. No API keys, no secrets, no CLI.

## Deploy steps

```bash
git add .
git commit -m "Simplify to PayPal.me — no backend"
git push
```

GitHub Pages picks it up automatically within a minute or two — same as
every previous deploy. There is nothing else to run, configure, or deploy.
`.github/workflows/test.yml` runs the automated tests on every push
automatically; it needs no secrets and can't fail for account/deployment
reasons, since there's no longer anything external for it to deploy to.

## Changing the price later

Open `config.js`, change both the amount in `payPalLink` and `priceLabel`
to match, save, commit, push. That's the whole process — no redeploy step
beyond the normal `git push`.

## Two payment modes — the page picks automatically

`config.js` controls which mode is active. You don't choose a mode
explicitly — the page checks whether `workerBase` and `paypalClientId`
are filled in with real values and switches automatically:

- **Not filled in (default):** the manual flow — a PayPal.me link plus a
  click-then-confirm step. Zero backend, zero setup beyond claiming a
  PayPal.me link. This is what you've been using.
- **Filled in:** real, automatic verification. PayPal's own payment
  buttons render, and a small server-side check confirms the payment
  actually completed with PayPal before anything unlocks — no more
  honor system.

## Setting up real payment verification (optional)

This needs a tiny piece of server code, because verifying a payment with
PayPal requires a secret key that must never be visible in a browser.
Cloudflare Workers gives you a free way to run that one small check —
**entirely through their website**. No command line, no installing
anything, no `node_modules`, no GitHub Actions.

### A. Get PayPal API credentials (5 minutes)

1. Log into **developer.paypal.com** as `kabaa01@yahoo.com`.
2. **Apps & Credentials** → **Create App** → give it any name → Create.
3. Copy the **Client ID** and **Secret** shown — you'll need both shortly.
4. Start with the **Sandbox** app first to test safely before going live.

### B. Deploy the verification code (10 minutes, all in the browser)

1. Go to **dash.cloudflare.com** → log in (or sign up free) → **Workers & Pages**.
2. Click **Create** → **Create Worker** → give it any name (e.g.
   `steep-verify`) → **Deploy** (it deploys a placeholder first — that's fine).
3. Click **Edit code** — this opens a code editor right in your browser.
4. Delete everything in the editor, then open `cloudflare-worker-source.js`
   from this project on your computer, copy its entire contents, and paste
   it into the browser editor.
5. Click **Deploy** (or **Save and Deploy**) in the editor toolbar.
6. Copy the URL shown at the top (something like
   `https://steep-verify.your-name.workers.dev`) — this is your `workerBase`.

### C. Set the variables (5 minutes, all in the browser)

Still on that Worker's page: **Settings** → **Variables and Secrets** → **Add**:

| Name | Value | Type |
|---|---|---|
| `PAYPAL_CLIENT_ID` | from step A | Variable |
| `PAYPAL_CLIENT_SECRET` | from step A | **Secret** |
| `PAYPAL_MODE` | `sandbox` (switch to `live` later) | Variable |
| `ALLOWED_ORIGIN` | `https://kabaa01.github.io` | Variable |
| `PRICE_USD_CENTS` | `500` | Variable |

Click **Save and deploy** after adding them.

### D. Point the site at it

Open `config.js` in this project and fill in:
```js
workerBase: "https://steep-verify.your-name.workers.dev",
paypalClientId: "the Client ID from step A",
```
Save, then:
```powershell
git add .
git commit -m "Enable real payment verification"
git push
```

That's the entire setup. To change anything later (price, switch to
live mode, etc.), you go back to **Settings → Variables and Secrets** on
the Cloudflare dashboard and edit the value — no redeploying, no CLI, ever.

### Testing it

With `PAYPAL_MODE = sandbox`, use PayPal's sandbox test buyer account
(developer.paypal.com → Sandbox → Accounts) to pay without real money.
Once it works, change `PAYPAL_MODE` to `live` and swap in your live
Client ID/Secret from a live PayPal app (same Apps & Credentials page,
toggle from Sandbox to Live at the top).

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
- 9 tests covering the dual-mode payment setup: the manual click-then-
  confirm safeguard, the real-verification path only unlocking after
  PayPal itself returns `COMPLETED`, `config.js` never needing a secret,
  no leftover Stripe/Resend/Sheets code, no `worker/` folder or local
  `node_modules`/`wrangler.toml` ever reappearing, and
  `cloudflare-worker-source.js` stating plainly that it isn't auto-deployed.

Static checks re-run on every change: JSON validity, JS syntax (including
`cloudflare-worker-source.js`), GitHub Actions YAML validity, every DOM id
referenced in `app.js` matching one defined in `index.html`, and HTML tag
balance. Repo file listing was also checked directly to confirm no stray
Worker folders or install artifacts exist. All checks passed on three
consecutive full runs of this version.

**Not automated — still needs your pass**, because these require a real
browser/device or an actual PayPal payment:
- The manual flow: clicking "Pay with PayPal" and confirming it opens
  your real PayPal.me page with the right amount pre-filled.
- The verified flow (once set up): a real sandbox payment end-to-end —
  PayPal button → approve → report unlocks only after `COMPLETED`.
- Lighthouse/PWA audit (installability, offline behavior) in Chrome DevTools.
- Screen-reader pass and keyboard-only navigation.
- Mobile Safari/Chrome visual check.

I ran every check I could actually execute rather than claim an open-ended
"repeat until zero issues" loop in the abstract — that phrase only means
something against a live environment. Once you deploy, tell me what you
see and I'll fix anything that's off.
