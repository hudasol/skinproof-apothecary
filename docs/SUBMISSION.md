# Submission text (draft)

## Name

SkinProof Apothecary

## Tagline

Botanical skincare, with the evidence on the label.

## What it does

SkinProof helps people choose botanical skincare on evidence rather than on
ingredient names. A shopper takes a selfie, and **YouCam AI Skin Analysis**
scores eleven visible concerns. SkinProof uses the model's raw scores relative
to each other to suggest goals, the shopper adds hard limits (no fragrance, no
essential oils, no daisy-family plants, named ingredients), and the **Botanical
Evidence Ledger** checks every product in the catalogue in six published stages:

1. Hard exclusions, which nothing can override.
2. Whether the product's ingredient list could be verified.
3. Relevance to the chosen goals.
4. Evidence strength and formulation match, judged separately.
5. Eligibility and cautions.
6. A lexicographic ranking with ties reported.

The result is a short, ranked list. Each product has an Evidence Dossier showing
why it qualified or was set aside, the research behind each goal, the label as
published, and what is not known. When nothing qualifies, SkinProof says so.

For botanical tinted lip balms, **YouCam AI Makeup Virtual Try-On** renders the
shade on the shopper's own photo, with skin smoothing switched off so the skin
is not retouched. Shades that break the shopper's limits are never offered.

## Why it matters

Botanical skincare is sold on ingredients whose research usually tested a
different preparation, at an unstated strength, often inside a multi-ingredient
formula or a medical population. Shoppers, especially those with reactive skin,
cannot see that from a product page. SkinProof makes it visible. In its own
catalogue, only 4 of 44 studies are randomised everyday-use trials that isolate
the botanical, and only 5 of 22 skincare products state how much of an active
they contain.

## How it uses YouCam

* **AI Skin Analysis** (`/s2s/v2.0/task/skin-analysis`, 12 SD concerns, JSON):
  File API upload, task, polling, normalised scores, skin type and detection
  masks. Raw scores only; the adjusted UI score, skin age and overall score are
  deliberately not used.
* **AI Makeup Virtual Try-On** (`/s2s/v2.0/task/makeup-vto`, `lip_color`):
  colours measured from each brand's swatch, gloss texture, skin smoothing 0.
* One shared, typed client with runtime validation, 429 back-off, error
  guidance in plain language, a daily unit budget and contract tests for both APIs.

## How it was built

Next.js 16, SQLite/Drizzle, sharp and zod; 83 unit and integration tests and 18
Playwright end-to-end tests. The catalogue holds 12 botanicals, 44
PubMed-verified studies, 22 skincare products and 3 lip tints, with sources and
check dates. The project started on 18 October 2026 and reuses infrastructure
from the author's earlier TryOn entry, as described in the README.

## Testing instructions

Clone the repository, then `npm ci`, `cp .env.example .env.local` and
`npm run dev`. Fixture mode works with no API key and labels every placeholder
result. For live mode, add a YouCam key and set `PROVIDER_MODE=live`.

## Status to state honestly

Update this section after the live checks: whether SkinProof's own Skin
Analysis and try-on calls were verified against the live service, and on what
date.
