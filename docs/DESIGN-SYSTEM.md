# Design system

A contemporary apothecary register: the visual language of herbarium sheets
and pharmacy ledgers, used to make evidence legible.

## Tokens (`src/app/globals.css`)

| Role | Token | Value |
| --- | --- | --- |
| Ink and primary actions | `--green-800` / `--green-900` | `#1f3a2e` / `#14261d` |
| Paper (green-cast ivory, not warm cream) | `--paper`, `--paper-raised`, `--paper-sunk` | `#f2f0e6`, `#f8f7f0`, `#e9e6d9` |
| Quiet structure | `--sage-500`, `--sage-300`, `--sage-100` | `#8fa58c`, `#c3cfbd`, `#e8ecdf` |
| Caution only | `--amber-600`, `--amber-100` | `#a8701a`, `#f3e7cc` |
| Exclusion only | `--madder-700`, `--madder-100` | `#8a3b2b`, `#f1ddd6` |
| Unverified | `--slate-600`, `--slate-100` | `#5d6560`, `#e3e5e0` |

Type: **Libre Caslon Display** for headings (the face of 18th-century
botanical printing), **Libre Caslon Text** italic only for Latin plant names
(a botanical convention, not decoration), **Public Sans** for interface and
data. Scale ratio 1.25 from 1rem. Body measure ≤ 66ch.

## Principles

* **One bold element.** The herbarium plates and their label cards carry real
  catalogue facts. Everything else stays quiet.
* **Structure is information.** Numbers appear only for real sequences: the
  five consultation steps, the six Ledger stages, rank order.
* **Colour has meaning.** Amber means caution, madder means excluded, slate
  means unverified. Nothing else uses them.
* **One vocabulary.** `src/lib/view.ts` holds the single name for every
  outcome, grade and match level.
* **Provenance is always visible.** Fixture results carry a dashed amber
  “Fixture, not YouCam” mark, and a band on every page announces fixture mode.
* **Motion only on action,** except one entrance for the hero plate.
  `prefers-reduced-motion` is respected.

## Components

| Component | Purpose |
| --- | --- |
| `BotanicalPlate`, `SpecimenSheet` | Original line drawings of the 12 plants; herbarium label with live facts |
| `OutcomeMark`, `GradeChip`, `ApplicabilityChip`, `ProvenanceMark` | One visual per state |
| `DecisionTrail` | A product's factors by Ledger stage, with unreached stages shown |
| `IngredientLabel` | The published list with SkinProof's readings marked |
| `StudyList` | Citable study records with design, setting, preparation, findings, limits |
| `JobProgress` | Polling progress for analysis jobs |
| `CompareSlider` | Before and after with a native range input |
| `ConsultSteps` | The consultation sequence |

## Accessibility

Visible focus (amber outline), skip link, labelled form controls, error
messages tied to fields, `role=status` and `role=alert` for progress and
failures, a keyboard-operable crop box, a native range input for the
comparison slider, no sideways scrolling at 375 px (tested), and
`aria-current` for the active navigation item.
