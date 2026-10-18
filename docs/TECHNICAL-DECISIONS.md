# Technical decisions

Each entry gives the decision, why, and what it costs.

## TD-1 A new repository beside TryOn, reusing its infrastructure

No SkinProof code existed when work began on 18 October 2026. The reusable
base was TryOn, the author's live-verified lipstick-VTO QA tool. Building
SkinProof inside TryOn would have replaced a complete, separately submittable
product with an unrelated one. The rules allow several entries if each is
substantially different, so SkinProof has its own repository and ports TryOn's
proven parts.

## TD-2 One Next.js application, kept from TryOn

Next.js 16 (App Router, Node runtime) serves pages, server actions, route
handlers and background jobs from one process. Server-only modules hold the
API key. Cost: jobs run in the web process; a restart marks them interrupted
and the person retries.

## TD-3 SQLite through Drizzle; the catalogue in versioned JSON

Consultations, analyses, decisions and previews live in SQLite with migrations.
The curated catalogue lives in `src/data/catalogue/*.json`, validated with zod
and cross-checked at start-up, and its content hash is the catalogue version
recorded on every decision. Keeping it in git makes every change to evidence or
product data reviewable and attributable, which matters more here than editing
it at runtime.

## TD-4 A deterministic, rule-based decision engine; no language model

The Ledger is pure TypeScript over the catalogue and the person's inputs. It
uses ordered categories, not weighted scores: evidence grades, formulation
match levels and a lexicographic rank key, so a preference can never outweigh
evidence and no number pretends to scientific precision. Every factor in a
decision names a rule in the published register. Explanations are written from
those factors by templates. A language model could phrase them more fluently
but could also invent; it was not worth the risk.

## TD-5 Evidence strength depends on study setting and isolation

Curating the real literature showed most botanical trials test whole
multi-ingredient products or medical groups. Counting those as “randomised
trial” evidence for an ingredient would overstate it, so each study records
its setting (cosmetic, acute irritation model, medical) and whether it isolates
the botanical. Only isolating cosmetic RCTs count as full trials; whole-product
trials and acute models cap at “limited”; medical studies are shown, not counted.
A systematic review that does not support the use caps the grade at moderate.

## TD-6 Preparations are structured; concentrations only as stated

Studies and product ingredients both carry `{part, form, compound}`. A product
benefits from a study only if the preparation matches; isolated compounds match
only the same compound. Concentrations exist only where a brand or study states
them, with the exact wording. Nothing is inferred from list order.

## TD-7 One shared YouCam client for both APIs

TryOn's adapter was generalised into `YouCamClient` (File API, 429 back-off,
polling that tolerates running-state nulls, https-only downloads, error
guidance). The Skin Analysis and Makeup adapters are thin layers on it, so the
parts TryOn verified live are the parts both APIs use.

## TD-8 Skin Analysis: 12 SD concerns, JSON, raw scores only

SD works with ordinary phone photos (short side 480 px; HD needs 1080 px) and 9–12
concerns cost the same 14 units. `format: json` returns scores and mask URLs in
one response. SkinProof reasons only with `raw_score`; the documentation says
`ui_score` is adjusted upward on purpose. `skin_age` and the overall score are
not used or shown. Focus suggestions are the lowest raw scores relative to the
person's own results, because YouCam publishes no clinical cut-offs.

## TD-9 Try-on for botanical lip tints only, with skin smoothing at 0

The makeup API renders makeup effects, not skincare, so the only honest place
for it in a skincare shop is tinted balms. The engine smooths skin by default;
SkinProof always sends it at 0 so no preview ever shows retouched skin. Shades
are rendered with the `gloss` texture TryOn verified live. Exclusions apply to
try-on too: a shade that breaks a person's limits is not offered.

## TD-10 Shade colours measured from brand swatches

The API takes hex colours and brands publish none. A script measures each
shade from the brand's own swatch image (densest pixels of the smear, darkest
tenth dropped) and records method and date. Shades with no swatch get no colour
and cannot be previewed rather than a guessed one.

## TD-11 Anonymous consultations and short retention

A random id in an httpOnly cookie, no accounts. Images are deleted after 24
hours, consultations after 30 days, everything at once on request. Images are
served only to the owning cookie and never cached by shared caches.

## TD-12 Live spending is opt-in and bounded

`PROVIDER_MODE=fixture` by default. Live mode has a daily unit budget computed
from the documented unit table (failed tasks are free and not counted), an
optional access code for hosted copies, and a live-check script that does
nothing paid without `--spend`.

## TD-13 Plain CSS with tokens, original illustration

CSS custom properties and CSS Modules, as in TryOn. The botanical plates are
original SVG built from shared leaf, petal and stem generators. No brand
photography is used, for licensing reasons and because the app's subject is the
evidence, not the packaging.
