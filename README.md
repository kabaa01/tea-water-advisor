# Steep & Standard — Water & Brew Advisor

A free Progressive Web App (PWA — a website that can be installed like an
app and works offline) that estimates how your water chemistry affects
the taste of tea or coffee, and gives a brew-specific golden ratio to
aim for. No payment, no account, no backend.

## What this is / is not

- **Is:** a scoring tool built from published brewing-water research (see
  Sources below), giving an *estimate* of likely taste impact, with an
  optional location-based starting point for people who don't have a
  water test handy.
- **Is not:** a certified water-safety test, a medical/health tool, or a
  claim that works for "any food" — it's scoped to tea and coffee, where
  the water-chemistry-to-taste link is actually documented. The fluoride
  check is a safety flag pointing to a proper lab test, not a diagnosis.
  The location estimate is a **regional pattern**, not a live reading of
  your actual tap — see below.

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
| GPS | Global Positioning System — used here only to identify your country |
| CI | Continuous Integration — automatically running tests on every code change |

## The location-based estimate — how it actually works, and its limits

**There is no live public API that reports real water chemistry for an
arbitrary GPS coordinate anywhere in the world.** No app can honestly
offer that today. What this feature does instead, and says plainly in
the UI:

1. When you tap "Estimate from my location," your browser asks your
   permission (nothing happens without an explicit click — this is never
   requested automatically on page load).
2. Your coordinates are sent once to **OpenStreetMap's Nominatim service**
   (a free, public reverse-geocoding API) purely to resolve which
   **country** you're in. Nothing is stored by this app.
3. Your country is matched against a small table built from **published,
   general water-hardness classifications** — not live data. Countries
   not in the table fall back to a global typical-average estimate,
   clearly labeled as such.
4. That match pre-fills the pH/TDS/hardness dials as a **starting point**.
   You can and should override it with real numbers from a water-test
   strip or lab report if you have them.

### Sources for the regional water-hardness classifications

- World Health Organization hardness bands (soft / moderately hard / hard
  / very hard, in mg/L as CaCO₃).
- U.S. Geological Survey, *Hardness of Water* (Water Science School) and
  USGS national hardness mapping.
- Regional water-utility hardness surveys summarized by HomeWater101 and
  Crystal Quest (United States); wassertipps.de (Europe); a PMC-indexed
  study on tap-water hardness patterns in Japan.
- For Kenya specifically: Kenya Water Institute (KEWI) and University of
  Nairobi studies on Nairobi-area borehole and tap water, and published
  summaries of KEBS/WHO-referenced water-quality patterns, which document
  widespread hard groundwater and elevated fluoride risk in parts of the
  country, particularly the Rift Valley.

This is intentionally coarse — a starting point for people with no test
kit, not a substitute for one.

## Deploy steps

```bash
git add .
git commit -m "Remove payment, add location-based water estimate"
git push
```

GitHub Pages picks it up automatically within a minute or two. There is
nothing else to run, configure, or deploy — there's no config file left
at all, since there's nothing left to configure. `.github/workflows/test.yml`
runs the automated tests on every push automatically; it needs no secrets.

## International UI/UX practices applied here

- **Consent-first location access** — the browser's permission prompt
  only ever appears after an explicit tap, never on load, and the button
  copy states exactly what happens with the data before asking.
- **Graceful degradation** — if location is denied, unsupported, or the
  lookup fails, the page falls back to manual entry with a plain message,
  never a dead end.
- **No dark patterns** — the estimate is clearly labeled as an estimate
  everywhere it appears, not presented as a measurement.
- **Progressive disclosure** — advanced fields (alkalinity, fluoride,
  chlorine) stay collapsed until asked for.
- **Free-text-free inputs** — every value is a slider or number field, so
  there's no possibility of malformed or unsafe text input.

## The detailed report

The report (shown immediately after checking — nothing is gated anymore)
includes: a plain-English summary paragraph, a full breakdown of every
tested parameter (your reading, the ideal range, and a real explanation
of what it's doing to the cup), a fluoride/chlorine safety callout when
relevant, and general brewing guidance (water temperature and steep time)
for the chosen beverage, sourced from widely published brewing practice
and the SCA Golden Cup standard for coffee.

## Sources for the scoring thresholds

- Tea pH/TDS/hardness targets and their taste effects: brewing-water
  studies on catechin extraction and infusion color (e.g. *ScienceDirect*,
  "The types of brewing water affect tea infusion flavor by changing the
  tea mineral dissolution," 2023; "Effects of different types of water on
  the sensory and physicochemical properties of cold-brewed green tea,"
  2026).
- Coffee targets: Specialty Coffee Association (SCA) Golden Cup water
  standard (TDS 150 mg/L target, 75–250 range; calcium hardness 68 mg/L
  target, 17–85 range; alkalinity ~40 mg/L; pH 7.0, 6.5–7.5 range).
- Fluoride guideline: World Health Organization (WHO) drinking-water
  guideline / Kenya Bureau of Standards (KEBS), 1.5 mg/L.

These are general reference ranges, not a substitute for an accredited
lab report — the in-app copy says this, and so does this file.

## QA performed

Automated (re-run anytime with `node --test tests/*.mjs`, and
automatically on every push via `.github/workflows/test.yml`):

- 10 scoring-engine tests (ideal/bad water, boundary handling, missing
  fields, fluoride/chlorine flags, invalid beverage, all profiles
  reachable, percentages always 0–100).
- 1 path-regression test (fails the build if any asset reference breaks
  on GitHub Pages again).
- 10 location-estimate tests: known country codes resolve to real numbers,
  Kenya specifically carries its fluoride caution, unknown countries fall
  back to a global default instead of failing, country-code matching is
  case-insensitive and doesn't throw on missing input, every region entry
  in the table resolves to a plausible pH, location lookup only ever
  fires from the button's click handler (never on page load), no PayPal
  or payment code remains anywhere, `config.js` no longer exists, and the
  old locked/unlocked report gate is fully gone.

A functional smoke test also ran the full pipeline end-to-end in Node —
resolving Kenya's estimate and feeding it through the actual scoring
engine for black tea — and confirmed the result is not just "a number"
but a realistic, defensible one: Kenya's documented hard water scores
as a poor match against tea's tighter mineral tolerances, consistent
with real-world reports of scale buildup and dulled flavor there.

Static checks re-run on every change: JSON validity, JS syntax, GitHub
Actions YAML validity, every DOM id referenced in `app.js` matching one
defined in `index.html`, and HTML tag balance. Repo file listing was
checked directly to confirm no stray payment files or config remain.
All checks passed on three consecutive full runs of this version.

**Not automated — still needs your pass**, because these require a real
browser/device:
- Actually granting/denying the location permission prompt on a phone.
- Confirming the Nominatim lookup returns a sensible country for a real
  GPS fix (not just the logic that consumes its result).
- Lighthouse/PWA audit (installability, offline behavior) in Chrome DevTools.
- Screen-reader pass and keyboard-only navigation.
- Mobile Safari/Chrome visual check.

I ran every check I could actually execute rather than claim an
open-ended "repeat until zero issues" loop in the abstract. Once you
deploy, tell me what you see and I'll fix it the same way: reproduce,
patch, re-test.
