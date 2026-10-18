# The Botanical Evidence Ledger

Code: [src/lib/ledger/engine.ts](../src/lib/ledger/engine.ts). Rule register:
[src/lib/ledger/rules.ts](../src/lib/ledger/rules.ts) (rendered at `/ledger`).
Tests: [tests/unit/ledger.test.ts](../tests/unit/ledger.test.ts) and
[tests/integration/catalogue.test.ts](../tests/integration/catalogue.test.ts).
Current version: `ledger-1.0.0`.

## Inputs

* Up to three cosmetic goals (suggested by the analysis or chosen).
* Hard limits: no fragrance, no essential oils, no labelled fragrance
  allergens, no daisy-family plants, named ingredients.
* “My skin reacts easily” (adds cautions, never exclusions).
* Preferred product types (last ranking key only).

The analysis does not enter the Ledger directly: it only suggests goals, which
the person confirms. Inputs are normalised (sorted, lower-cased where
appropriate) and hashed; the hash, the rule version and the catalogue version
are stored with every decision. The same three give the same decision.

## Pipeline, per product

| Stage | Rule | Effect |
| --- | --- | --- |
| 1. Exclusions | X1–X5 | Any match excludes the product. Checked first; nothing later can undo it. |
| 2. Product information | V1 | No traceable full ingredient list: outcome *unverified*, never eligible; if limits are set, they “cannot be confirmed”. |
| | V2, V3 | Partly resolved information or conflicting sources: caution. |
| 3. Relevance | R1 | No catalogue botanical with a study of the person's goals: *not relevant*. |
| 4. Evidence and formulation | E1, A1 | Graded separately for each goal, using the best ingredient link. |
| 5. Eligibility and cautions | Q1 | At least one goal with human evidence (limited, moderate, strong or conflicting) on a matching preparation, else *limited evidence*. |
| | C1–C3 | Reactive skin with scent ingredients or sourced safety notes; conflicting trials: caution. |
| 6. Ranking | K1 | Eligible and cautioned products ordered by the rank key. |

## Evidence strength (E1)

For one botanical preparation and one goal:

| Grade | Rule |
| --- | --- |
| Strong | ≥ 2 full trials supporting (a supporting systematic review counts as one), none against, no non-supporting review |
| Moderate | 1 full trial or a supporting review; or strong, capped by a non-supporting review |
| Conflicting | full trials on both sides, or a null full trial alongside other support |
| Limited | only non-randomised studies, acute irritation tests or whole-product trials support it |
| Not supported | counted human studies found no effect |
| Preclinical | only cell or animal studies support it |
| None | nothing counted |

A **full trial** is randomised, in everyday cosmetic use, and isolates the
botanical. Medical-setting studies are never counted.

## Formulation match (A1)

| Level | Rule |
| --- | --- |
| Close match | same preparation, same use, stated amount ≥ lowest studied amount, plant part confirmed |
| Amount not stated | same preparation and use; the product states no amount (or the studies state none) |
| Weaker match | same preparation but lower stated amount, or leave-on studies backing a rinse-off product |
| Different preparation | no study of this part, form or compound; does not count |

## Rank key (K1)

Compared element by element; later keys matter only when all earlier keys tie.

1. No cautions.
2. Number of goals backed by moderate or strong evidence on a matching preparation.
3. Best evidence grade among qualifying links.
4. Best formulation match among qualifying links.
5. Number of goals backed at all.
6. Matches a preferred product type.

Products equal on all six are reported as tied and listed alphabetically by id.
The shortlist shows the first five.

## Honest outcomes

`eligible`, `caution`, `excluded`, `unverified`, `limited_evidence`,
`not_relevant`, and a decision status of `shortlist` or `no_match`. Unknown
information is never treated as safe, and never treated as dangerous.

## Colour products

Lip tints make no efficacy claim, so they skip stages 3–6. Each shade is
checked against the person's limits and verification only (`checkColourShade`),
and an excluded or unverified shade cannot be tried on.
