# YouCam API verification record

This file separates what the official documentation says, what has been tested
against the real service, and what is still unknown. Update it every time a
live check runs.

## Sources

* Skin Analysis OpenAPI bundle:
  `https://docs.perfectcorp.com/_bundle/reference/ai_skin_analysis.json?download`
  (overview, inputs and outputs, file specs, error codes, unit table)
* Makeup VTO OpenAPI bundle:
  `https://docs.perfectcorp.com/_bundle/reference/makeup_vto.json?download`
* File API, task management and unit system bundles (same path: `file`,
  `task_management`, `unit_system`)
* Lip shape catalogue: <https://plugins-media.makeupar.com/wcm-saas/shapes/lipshape.json>

Skin Analysis bundle read **2026-10-18**. The Makeup VTO, File and credit
contracts were read on 2026-10-17 for TryOn and re-checked on 2026-10-18.

## What was already verified live (TryOn, same account, 2026-10-18)

SkinProof reuses TryOn's YouCam client. These parts of the shared chain were
verified against the real service by TryOn (records in that repository's
`docs/API-VERIFICATION.md`):

| Check | Result |
| --- | --- |
| Bearer authentication | Works |
| `POST /s2s/v2.0/file` with `image/jpeg`, then presigned `PUT` | Works |
| `GET /s2s/v1.0/client/credit` | `results[]` of `{type, amount_dec, expiry}` |
| Makeup VTO task + poll | `{data:{task_id}}`; poll `running` then `success`; **while running, `results` can be `null`** |
| Makeup VTO result | `data.results.url`, signed S3 URL, PNG, no auth header |
| Makeup VTO output size | Even-sided input returns the same size |
| Units | 1 per successful makeup task, none for a rejected one |

## SkinProof live verification status

All on 18 October 2026, with the owner's approval for up to 44 units. Input:
YouCam's own documentation sample portrait (`sample_Image_7`, 1080 × 1437),
cropped to x 0.15, y 0.12, w 0.73, h 0.85 so the face fills the frame.

| Check | Status | Evidence |
| --- | --- | --- |
| Skin Analysis task (`/s2s/v2.0/task/skin-analysis`, 12 SD concerns, `format: json`) | **Verified live**: File API 200, upload 200, submit 200, `running` then `success` in 3 polls, 14.1 s | [skin record](live-checks/2026-10-18T07-52-52-568Z-skin.json) |
| Skin Analysis result shape | **Verified live**: `data.results.output[]` exactly as the OpenAPI json example; 17 items: 11 scored concerns (`region: "whole"`), `skin_type` for `whole`, `t_zone` and `u_zone`, plus `skin_age`, `all` and `resize_image` (ignored by design). No invalid, duplicate or out-of-range items | same |
| Score range | **Observed live**: `raw_score` can be exactly 100 (the docs say 1–100) | same |
| Skin Analysis masks | **Verified live**: 11 RGBA PNG masks, each exactly the input size (788 × 1221), so they overlay without resampling. Several were near-empty for this face (nothing detected) | same; images git-ignored |
| Units, Skin Analysis | **Verified live**: 14 units for 12 SD concerns, as the unit table states (1,030 → 1,016) | same |
| Makeup VTO `lip_color` from SkinProof's adapter | **Verified live**: Hurraw! Black Cherry `#C8524E`, gloss texture, skin smoothing 0; 3 polls, 9.4 s; `results.url` shape; PNG 810 × 1078 for an 810 × 1078 input | [try-on record](live-checks/2026-10-18T07-53-30-642Z-tryon.json) |
| Skin left untouched by the try-on | **Measured live**: 1.35 % of pixels changed by more than 12/255 on any channel, all inside one 200 × 100 px box over the mouth (2.3 % of the image) | same output, measured locally |
| Units, try-on | **Verified live**: 1 unit (1,016 → 1,015) | same |
| Full in-app journey in live mode | **Verified live**: one analysis and one try-on through the app's own services and pages, captured as `docs/screenshots/live-*.png`; 15 units (1,015 → 1,000) | screenshots |

Total spent on SkinProof's verification: **30 units**. Balance afterwards: 1,000.

What this does and does not show: the integration works end to end on one
portrait and one shade. The sample portrait has very even skin and scored near
the top of every scale; it says nothing about how the model behaves across
skin tones, ages or lighting.

## Skin Analysis contract (what the adapter implements)

**Lifecycle.** Same File API upload as makeup, then:

1. `POST /s2s/v2.0/task/skin-analysis` with `src_file_id`, `dst_actions[]`,
   `format: "json"` and optional `miniserver_args`. Response
   `{status, data: {task_id}}`. Errors: `400` with `error_code`
   (`InvalidParameters`, `CreditInsufficiency`, `BadRequest`), `401`, `429`.
2. `GET /s2s/v2.0/task/skin-analysis/{task_id}`: `data.task_status` is
   `running`, `success` or `error`. The docs say polling intervals can be
   relaxed; results stay queryable for 24 hours. **Units are only charged on
   success.**

**Concerns.** SD and HD concerns cannot be mixed (`400 InvalidParameters`,
"cannot mix HD and SD dst_actions"). SkinProof sends 12 SD concerns:
`redness, oiliness, moisture, texture, pore, acne, radiance, age_spot,
wrinkle, firmness, dark_circle_v2, skin_type`. 9–12 SD concerns cost
**14 units**.

**Result (`format: json`).** `data.results.output[]`, each item with:

| Field | Meaning (docs) | SkinProof use |
| --- | --- | --- |
| `type` | concern id, or `skin_age`, `all`, `resize_image` | concern ids are mapped; `skin_age` and `all` are ignored (see below) |
| `region` | `whole`, or a sub-region (`t_zone`, `u_zone`, `forehead`…) | only `whole` scores feed the Ledger; skin-type zones are shown |
| `raw_score` | 1–100, "the score directly predicted by the AI model"; higher = healthier | **the score SkinProof uses** |
| `ui_score` | 1–100, adjusted upward on purpose ("psychological motivator") | recorded, never used for decisions |
| `skin_type` | Normal, Oily, Dry, Combination, Redness and combinations | shown as returned |
| `score` | for `all` (overall) and `skin_age` | not used |
| `mask_urls` | mask images per concern | downloaded and shown as overlays, deleted with the photo |

SkinProof does not show `skin_age` or the overall `all` score: neither is
needed for the product logic, and a single "skin age" number invites a
judgement the product does not want to make.

**Input limits (SD).** jpg/jpeg/png, under 10 MB, short side at least 480 px,
long side resized by the service above 2560 px. The face must be wider than
60 % of the image width. Engine errors: `error_below_min_image_size`,
`error_exceed_max_image_size`, `error_src_face_too_small`,
`error_src_face_out_of_bound`, `error_lighting_dark`, plus the general list
(`error_no_face`, `error_pose`, `error_face_parsing`, `error_inference`,
`error_nsfw_content_detected`, …).

## Makeup VTO contract (as used by SkinProof)

Unchanged from TryOn: `lip_color` with `shape.name` from `lipshape.json`,
`palettes[]` of `{color, texture, colorIntensity}` plus the fields each texture
requires, `style.type: "full"`. **Skin smoothing is applied at 50 unless a
`skin_smooth` effect at 0 is sent.** SkinProof always sends it at 0, so a lip
preview never retouches the skin around it. Inputs are fitted within
1919 × 1079 with even sides.

The makeup API has **no product or SKU catalogue**: every shade is sent as a
hex colour. Brands do not publish hex values, so SkinProof's shade colours are
measured from the brand's own swatch image and labelled as approximations
(`docs/CATALOGUE-METHOD.md`).

### What the live run changed

* Analysis masks now open on the first suggested focus area and are ordered
  lowest score first. Live, the first mask by fixed order (redness) was empty
  for this face, which made the overlay look broken.
* Nothing in the adapters needed changing: the live responses matched the
  documented shapes the contract tests encode.

## Discrepancies in the official docs

| # | Topic | Source A | Source B | What the adapter does |
| --- | --- | --- | --- | --- |
| S1 | Skin result shape for `format: zip` | Schema: `results: { url }` | Example: `results: "https://…"` (a bare string) | SkinProof requests `json`, so neither applies; a string or `{url}` is recorded as "zip result received" and rejected |
| S2 | Skin Analysis v2.0 vs v2.1 | Same request schema; v2.1 adds `pf_camera_kit` | — | Uses v2.0, which the integration guide's examples use |
| S3 | `ui_score` meaning | Overview: "adjusted… to produce more favorable results" | Schema: "adjusted score based on the raw score" | Uses `raw_score` only |
| S4 | Skin `error` on a task | Schema enum lists general engine errors | File-specs table lists `error_src_face_too_small` etc., not in the enum | Accepts any string; known codes get plain-language guidance |

## How to run the live check

```bash
cp .env.example .env.local      # then put the key in YOUCAM_API_KEY
npm run verify:live -- --image path/to/your-own-portrait.jpg
```

The script refuses to spend units unless it is given `--spend`, prints the
planned units first, never prints the key, and writes a dated record to
`docs/live-checks/`.
