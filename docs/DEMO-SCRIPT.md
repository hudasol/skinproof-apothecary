# Demo video script (2 min 40 s)

Record on desktop at 1366 × 900 or larger. Use only behaviour the app really
has. If the video is recorded in fixture mode, the amber “Demonstration data”
band and the “Fixture, not YouCam” marks must stay visible, and the narration
must say the analysis and try-on shown are placeholders. Record in live mode
only after the live checks in `docs/API-VERIFICATION.md` pass, and only with
your own face or a photo you have rights to. No music; no brand logos beyond
product names shown as text in the app.

| Time | Screen | Narration |
| --- | --- | --- |
| 0:00 | Landing, hero plate | “Natural skincare sells ingredients. SkinProof checks whether the research behind them actually applies to the product you are about to buy.” |
| 0:12 | Hover the Centella label: 4 human studies, 0 isolating trials | “Cica is on dozens of labels. Every human study we found tested a whole product or a medical group.” |
| 0:20 | Consult: consent page, tick both boxes | “The consultation starts with plain consent: the photo goes to YouCam’s Skin AI, we keep it for a day, and you can delete everything.” |
| 0:32 | Photo, crop box | “The crop helps the face fill the frame, as YouCam’s Skin Analysis API requires.” |
| 0:40 | Analysis results chart, masks (live) | “YouCam AI Skin Analysis scores eleven visible concerns. We use the model’s raw scores, relative to each other, and ignore the flattering UI score and skin age. The three lowest become suggested goals.” |
| 0:58 | Goals: tick ‘No added fragrance’ | “You confirm goals and set hard limits. Limits are absolute.” |
| 1:05 | Shortlist | “The Botanical Evidence Ledger runs every product through six stages. Here are the eligible ones, in order, with evidence strength and formulation match side by side. The footer records the rule and catalogue versions: the same choices always give the same decision.” |
| 1:25 | Open ‘Set aside’: Excluded → Weleda; open its dossier | “Products that break a limit stop at stage one, whatever their evidence. The dossier shows why, line by line, and the label exactly as published.” |
| 1:45 | Innisfree dossier, evidence table | “This serum is named after green tea seed oil. The studies used leaf extract, so the seed oil counts for nothing, and no amount is stated. Unknowns stay unknown.” |
| 2:00 | Compare two products | “Compare puts the same facts on the same rows.” |
| 2:08 | Lip colour studio: try Black Cherry, drag the slider | “For tinted balms, YouCam’s Makeup Virtual Try-On renders the shade on your own photo, with skin smoothing switched off so your skin is not retouched. Colours are measured from the brand’s own swatch. A try-on shows a colour, not a result.” |
| 2:28 | Hurraw shade excluded by the fragrance limit | “And a shade that breaks your limits is never offered.” |
| 2:34 | /ledger page | “Every rule is published, and the engine and its tests are open source. SkinProof: skincare with the evidence on the label.” |

Before recording: run `npm run test:e2e`, use a fresh browser profile, and make
sure the unit balance covers one analysis (14 units) and two try-ons (2 units)
if recording live.
