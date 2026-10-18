# Hackathon requirements

Sources, read in a browser on **2026-10-18**:

* Official rules: <https://youcam-api-skin-ai-ecommerce.devpost.com/rules>
* Overview: <https://youcam-api-skin-ai-ecommerce.devpost.com/>
* Resources: <https://youcam-api-skin-ai-ecommerce.devpost.com/resources>

The rules state they prevail over any other hackathon material (§11 D).

## Dates (Eastern Time)

| Event | Date |
| --- | --- |
| Submission period | 2026-09-29 12:00 → **2026-11-02 11:45** |
| Judging | 2026-11-03 → 2026-11-20 |
| Winners announced | about 2026-11-24 |

## Theme fit

The overview names two topics. SkinProof is a **Skin AI** entry: the topic asks
for something that meets the moment "right before a purchase" and helps users
"understand their skin and know exactly what to do next", using Skin AI "alone
or combined with other YouCam APIs". SkinProof combines Skin Analysis with the
Makeup Virtual Try-On API for one product family (botanical lip tints).

SkinProof is a second, separate entry from the same entrant (TryOn, a QA tool
for lipstick try-on). The rules allow several submissions if each is "unique
and substantially different" (§4, Multiple Submissions). SkinProof is a
consumer shopping product built around Skin Analysis; TryOn is a retail QA
workflow around Makeup VTO. They share infrastructure code, not purpose.

## Requirements matrix

Status: **Done** (implemented and verified as described), **Partly**,
**Pending** (needs an external step), **Owner** (only the entrant can do it).

| # | Requirement (source) | Product behaviour | Where | Verified by | Status |
| --- | --- | --- | --- | --- | --- |
| R1 | Working application that integrates at least one YouCam API (rules §4) | Skin Analysis drives goals and the Ledger; Makeup VTO previews lip tints | `src/lib/providers/youcam/` | Adapter contract tests; live check record in `docs/API-VERIFICATION.md` | **Done**: both verified live on 2026-10-18 (Skin Analysis 14 units, try-on 1 unit, plus one full in-app live run) |
| R2 | Clear consumer or eCommerce value (rules §4) | Shopper goes from a selfie to a short, explained list of real products, with retailer links and a try-on for colour products | `src/app/` journey | E2E journey test | Done |
| R3 | Installs and runs consistently on its intended platform (rules §4) | Responsive web app, one Node process, SQLite, no other services | README setup | Fresh `npm ci` + build + tests | Done: fresh install, build and tests verified; live mode verified (docs/TESTING.md) |
| R4 | New, or significantly updated in the submission period (rules §4) | New repository, first commit 2026-10-18; infrastructure ported from the entrant's own TryOn project and stated as such | git history, README | — | Done |
| R5 | Authorised use of third-party SDKs, APIs and data (rules §4) | Permissive open-source dependencies; product data are short factual ingredient lists with source links; no brand photography; no photos of people in the repo except YouCam’s own documentation sample portrait in the live screenshots | `docs/CATALOGUE-METHOD.md` | Review | Done |
| R6 | Repository URL with all source, assets, instructions; public with licence or shared with contact_event@PerfectCorp.com (rules §4) | Public GitHub repo, MIT licence | `LICENSE` | — | Done |
| R7 | Text description of features, functionality and consumer value (rules §4) | Draft submission text | `docs/SUBMISSION.md` | — | Draft in docs/SUBMISSION.md |
| R8 | Screenshots (overview page) | Captured from the running app, labelled fixture or live | `docs/screenshots/` | — | Done: a live set (`live-*`) and a fixture set (`fixture-*`) |
| R9 | 1–3 minute public video on YouTube/Vimeo, explaining the YouCam API used, showing the project running (rules §4) | Script with timings built from the real journey | `docs/DEMO-SCRIPT.md` | — | Owner records and uploads |
| R10 | No third-party trademarks or copyrighted music in the video without permission (rules §4) | Script avoids music; product names appear only as factual catalogue entries | `docs/DEMO-SCRIPT.md` | Check at capture | Owner |
| R11 | Testing access free and unrestricted until judging ends (rules §4) | Fixture mode runs with no key; live mode is gated by a unit budget and an optional access code | README, `.env.example` | — | Hosting is the owner's decision |
| R12 | English materials (rules §4) | All English | — | — | Done |
| R13 | Original work solely owned by the entrant (rules §4, §7) | Written for this entry; botanical illustrations drawn as original SVG | — | — | Done |
| R14 | Project must function as shown in the video (rules §4) | Demo script uses only implemented behaviour; fixture output is labelled on screen | `docs/DEMO-SCRIPT.md` | — | Done, in fixture and live mode |

## Judging (rules §6)

Stage one is pass/fail: fits the theme and reasonably uses the required API.
Stage two scores four **equally weighted** criteria. Ties break in this order:

1. **Technological implementation**: how thoroughly and skilfully a YouCam
   API is integrated, clear consumer or eCommerce value, genuine non-trivial
   code. SkinProof's answer: two YouCam APIs behind typed adapters with
   runtime validation, polling, error mapping and a unit guard; a deterministic,
   tested decision engine whose input is the real analysis output.
2. **Design**: a complete, coherent product, not a proof of concept. One
   journey from consent to comparison, with loading, error, empty, retry and
   no-match states.
3. **Potential impact**: a specific problem for a specific audience. Shoppers
   choosing "natural" skincare face marketing claims that borrow evidence
   from ingredients studied in other forms, at unknown strengths; SkinProof
   shows what is actually known for each product.
4. **Quality of the idea**: a non-obvious use of the API. Skin Analysis output
   becomes the input to an inspectable evidence policy instead of a sales
   funnel, and the system is willing to say "no suitable match".

## API access for entrants

* 1,000 free units per registrant via a redeem code, valid 90 days from
  redemption (rules §4).
* Optional social-sharing bonus: 500 units per platform, at most two, claim
  by the end of the submission period (rules §8 F).
* Unit costs (YouCam docs, read 2026-10-18): Skin Analysis 9–22 units per task
  depending on SD/HD and number of concerns (SkinProof's 12 SD concerns cost
  **14**); Makeup VTO **1** per task. Failed tasks are documented as free.

## Terms that apply to images

* YouCam API use is subject to YouCam's and Perfect Corp.'s Terms of Service
  (rules §4, linked from the rules page).
* The rules forbid infringing privacy and publicity rights (§4 IP, §7).
* YouCam documentation: uploaded files and results are removed after 30 days;
  Skin Analysis results can be queried for 24 hours; result download URLs
  last 2 hours. SkinProof's own retention is in `docs/PRIVACY.md`.
