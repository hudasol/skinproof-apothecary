# Test record

Every result here was run and observed. Nothing in this file spends YouCam units.

## 18 October 2026

| Command | Result |
| --- | --- |
| `npm test` (Vitest) | 9 files, **83 passed** |
| `npm run typecheck` (`tsc --noEmit`, strict) | **clean** |
| `npm run test:e2e` (Playwright, production build, fixture mode) | **18 passed** (6 desktop, 12 phone) |
| `npm run catalogue:check` | all schema and cross-reference checks pass; 25 products (22 verified, 2 partial, 1 unverified) |
| `npx tsx scripts/verify-citations.ts` | **44 of 44** citations match PubMed |
| `npm run screenshots` (production build) | 15 screenshots captured |
| `npm run verify:live -- skin … ` and `… tryon …` without `--spend` | dry runs print the plan; nothing sent |
| TryOn baseline (`tryon-trust`, `npx vitest run`) before porting | 125 passed |

## What the suites cover

* **Ledger rules** (`tests/unit/ledger.test.ts`): every evidence grade,
  including setting and isolation; every applicability level, including
  rinse-off and unconfirmed plant part; each hard exclusion and that the best
  evidence cannot override it; unverified, partial, limited-evidence,
  not-relevant and caution outcomes; no-match; ranking order, ties and that a
  preference cannot outrank evidence; input-order independence and catalogue
  versioning.
* **Label reading** (`tests/unit/ingredients.test.ts`): splitting, footnotes,
  commas inside chemical names, fragrance, allergens (including the dual-use
  note), essential oils versus seed oils, daisy family, whole-word matching.
* **Adapters** (`tests/unit/youcam-*.test.ts`): request bodies exactly as
  documented, upload, polling with running-state nulls, masks, engine errors
  with guidance, CreditInsufficiency, 429 retry, timeout, contract mismatch
  with value-free diagnostics, network failure, both makeup result shapes,
  non-https result URLs.
* **Images** (`tests/unit/normalize.test.ts`): metadata stripping, size limits,
  crop and crop validation, try-on fitting.
* **Services** (`tests/integration/journey.test.ts`): consent gate, analysis
  job idempotency and ownership, reproducible decisions, try-on gated by
  exclusions and swatches, no double render, deletion of rows and files,
  retention purge, budget accounting.
* **Real catalogue** (`tests/integration/catalogue.test.ts`): across 36 goal
  sets × 5 constraint sets × 2, no unverified or excluded product is ever
  shortlisted and every factor names a published rule.
* **End to end** (`tests/e2e`): the full journey to deletion, a documented
  failure, an honest no-match, validation that keeps input, try-on with
  consent and re-use, refusal for excluded or unmeasured shades, phone menu
  and no sideways scrolling on 11 pages.

## Not yet verified

* SkinProof's Skin Analysis and Makeup adapters against the live YouCam
  service (requires approved unit spend; see `docs/API-VERIFICATION.md`).
* Behaviour on real faces of the fixture-free pipeline (masks, scores).
