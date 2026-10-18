# Test record

Every result here was run and observed. Only the live checks section spent YouCam units, with the owner’s approval.

## 18 October 2026

| Command | Result |
| --- | --- |
| `npm test` (Vitest) | 8 files, **83 passed** |
| `npm run typecheck` (`tsc --noEmit`, strict) | **clean** |
| Fresh clone of the repository: `npm ci`, `npm test`, `npm run typecheck`, `npm run build` | **all pass** |
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

## Live checks (approved, 30 units in total)

| Run | Result |
| --- | --- |
| `npm run verify:live -- credits` | 1,030 units before |
| `npm run verify:live -- skin --image-url <YouCam sample 7> --crop 0.15,0.12,0.73,0.85 --spend` | success, 14 units, 11 scores, skin type in 3 zones, 11 aligned masks |
| `npm run verify:live -- tryon --image-url <YouCam sample 7> --shade hurraw-tinted-lip-balm/black-cherry --spend` | success, 1 unit, output aligned, 1.35 % of pixels changed, all over the mouth |
| `SHOT_MODE=live SHOT_PREFIX=live npm run screenshots` | full journey in live mode, 15 units, 15 screenshots |
| `npm run verify:live -- credits` | 1,000 units after |

## Not yet verified

* Behaviour across faces, skin tones, ages and lighting. The live checks used
  one portrait and one shade.
* Hosted deployment: no public copy is running yet.
