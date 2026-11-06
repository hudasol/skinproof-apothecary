# Catalogue method

The catalogue is small on purpose: every record had to be traceable.

## Botanicals and studies

* 19 botanicals that appear on botanical skincare labels.
* 52 studies, found in PubMed and read from their abstracts (44 on 18 October 2026, 8 more on 6 November 2026;
  three details were checked in PMC full texts: PMC7471832, PMC5504505,
  PMC7603542). Every PMID, title and year was then checked against NCBI's
  E-utilities; `npx tsx scripts/verify-citations.ts` repeats that check.
* Summaries and limitations are written in SkinProof's own words.
* One oral rosehip supplement trial was left out of the topical library because it is not topical evidence. It is used on the herbal tea page, where oral evidence belongs.
* The 8 studies added on 6 November 2026 were found with PubMed searches by plant and read from their abstracts only. Details an abstract does not give (country, funding, product grade, blinding) are recorded as not stated, never inferred. Several have limits that are written into the record: a study that cannot separate the plant from a clay mask, an abstract that does not show a topical control group, and a trial whose effect size is unusually large. Plants searched without finding a usable human trial (for example mulberry, sea buckthorn, ginseng and pomegranate) were not added.
* For each study the curator recorded: setting (cosmetic, acute irritation
  model, medical), whether it isolates the botanical, the structured
  preparation (part, form, compound), and a concentration only when the study
  states one. These judgements are in the data and visible on every study.
* Safety notes cite PubMed or DermNet. Several are contact-dermatitis letters
  whose PubMed entries have no abstract; those notes rest on the title and are
  worded conservatively.
* Label (INCI) names listed for each botanical are common names for display.
  Product links never rely on them: every product-to-botanical mapping must
  match an entry on that product's own published list (`npm run catalogue:check`).

## Herbal teas

`src/data/catalogue/teas.json`, validated by `src/lib/catalogue/tea-schema.ts`.

* Nine plants: roselle, rose hip, gotu kola, green tea, chamomile, licorice root, dandelion, burdock root and marshmallow root. Drinking a plant is a different exposure from putting it on skin, so these are kept apart from the topical library.
* Each goal claim has a tier: **tried in people** (a trial in people measured a skin change), **traditional use only** (a review describes the use, no skin trial found) or **tested, did not help**. A traditional claim must cite a source, and a human trial claim must cite a trial; the loader refuses to start otherwise.
* Every trial records what people actually took (a brewed drink, a powder, an extract). Only one trial used a brewed drink. The page says so beside each result.
* Cautions come from PubMed reviews or case reports. A plant with no caution recorded means none was found, which the page states.
* Green tea is shown because it is often suggested for oily and blemished skin. The meta-analysis found oral extract had minimal effect, so it is never put in a blend.
* The blend is a rule, not a recipe (`src/lib/tea/plan.ts`): greedy cover of the person's goals, trials weighted above tradition, at most four plants, no amounts, because no study tested these plants together.
* Trial citations are checked against PubMed by `scripts/verify-citations.ts`.

## Products

* Ingredient lists were copied mechanically from brand pages fetched on
  18 October 2026, or rendered in a browser where scripted fetching was blocked.
  Misspellings on source pages are kept. Where a page shows ingredients as
  separate items, they were joined in page order and the record says so.
* A retailer page was used only where the brand page lacked Drug Facts
  (Aveeno Eczema Therapy, via the Aveeno store on Amazon); the record says so.
* Verification: **verified** (full list traced), **partial** (traced, with a
  named unresolved issue), **unverified** (no traceable list; never eligible).
* Concentrations are recorded only when the brand states them, with the exact
  wording (for example “Colloidal Oatmeal 1%”, “34,860ppm”).
* Where a brand names the compound behind an extract (Eucerin naming
  Licochalcone A for Glycyrrhiza Inflata Root Extract), the mapping records it
  with a note citing the brand.
* No prices, stock or ratings: none could be verified as current.
* Left out: The INKEY List Bakuchiol Moisturiser and Biossance Squalane +
  Phyto-Retinol Serum, both apparently discontinued (brand pages gone,
  retailers sold out).

## Lip tints and try-on colours

* ILIA and Hurraw! lists and swatch images come from the brand pages. Burt's
  Bees is *partial*: burtsbees.com could not be read, the Canadian brand page
  and US retailer labels differ, and the brand publishes no swatch.
* `scripts/measure-swatches.ts` measures each shade's rendering colour from the
  brand's swatch image: the 8 % of pixels furthest from white, darkest tenth
  dropped, median. Images are processed in memory and not stored. Shades with
  no swatch have no colour and cannot be previewed.

## Reading labels

`src/lib/catalogue/ingredients.ts` reads each verbatim list: fragrance words and
scent materials; the 26 EU-labelled fragrance allergens (Regulation (EC)
1223/2009 Annex III; the 2023 extension is not yet included); essential oils
(aromatic genera, excluding pressed seed oils); daisy-family genera (DermNet,
Compositae allergy). Every match names the ingredient that caused it, and
`npm run catalogue:check` prints all matches for curator review.

## Updating

Change the JSON, run `npm run catalogue:check` and the tests. The catalogue
version changes automatically, so stored decisions remain attributable to the
data they were made with.
