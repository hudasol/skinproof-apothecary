import type { RuleId } from './types';

/**
 * The Ledger's published rule register. The method page renders this list,
 * and every factor in a decision names one of these rules. Bump RULE_VERSION
 * whenever a rule's behaviour changes: decisions record the version they ran.
 */
export const RULE_VERSION = 'ledger-1.0.0';

export type RuleDoc = { id: RuleId; stage: string; title: string; rule: string; why: string };

export const RULES: RuleDoc[] = [
  {
    id: 'X1_fragrance',
    stage: '1 · Your exclusions',
    title: 'No added fragrance',
    rule: 'If you ask for no fragrance, any product whose label lists Parfum, Fragrance, Aroma or Flavor, or a named scent material such as Vanillin, is excluded.',
    why: 'You set this as a hard limit. Nothing later in the Ledger can override it.',
  },
  {
    id: 'X2_essential_oils',
    stage: '1 · Your exclusions',
    title: 'No essential oils',
    rule: 'If you ask for no essential oils, products listing a leaf, flower, peel, wood, resin or root oil from an aromatic genus (Mentha, Lavandula, Melaleuca, Citrus and others) are excluded. Pressed seed oils such as rosehip are not essential oils.',
    why: 'You set this as a hard limit.',
  },
  {
    id: 'X3_fragrance_allergens',
    stage: '1 · Your exclusions',
    title: 'No labelled fragrance allergens',
    rule: 'If you ask for this, products naming any of the 26 fragrance allergens EU law requires on labels (Limonene, Linalool, Citronellol…) are excluded.',
    why: 'You set this as a hard limit. Benzyl Alcohol is on the list and is also a preservative; the dossier says so when it is the cause.',
  },
  {
    id: 'X4_asteraceae',
    stage: '1 · Your exclusions',
    title: 'Avoid the daisy family',
    rule: 'If you ask to avoid Asteraceae (Compositae), products containing a plant from that family, including chamomile, calendula, arnica, feverfew and sunflower, are excluded.',
    why: 'You set this as a hard limit. Compositae allergy is a recognised cross-reactivity between plants of this family.',
  },
  {
    id: 'X5_named_ingredient',
    stage: '1 · Your exclusions',
    title: 'Ingredients you named',
    rule: 'Products whose label contains an ingredient you typed (matched as a whole word, ignoring case) are excluded.',
    why: 'You set this as a hard limit.',
  },
  {
    id: 'V1_unverified',
    stage: '2 · Product information',
    title: 'Unverified products are never recommended',
    rule: 'A product without a full ingredient list traced to a brand or retailer page cannot be eligible. If you set exclusions, the Ledger also says it cannot confirm them.',
    why: 'Missing information is not proof of safety, and it is not proof of danger either. The product is set aside, not excluded.',
  },
  {
    id: 'V2_partial',
    stage: '2 · Product information',
    title: 'Partly resolved information',
    rule: 'A product whose list is traced but has an unresolved issue (for example, different labels in different markets) can be listed only with a caution.',
    why: 'You should know what is still uncertain before you buy.',
  },
  {
    id: 'V3_source_conflict',
    stage: '2 · Product information',
    title: 'Sources that disagree',
    rule: 'When two trustworthy sources disagree about a product, it can be listed only with a caution naming the disagreement.',
    why: 'Conflicting information is shown, not resolved by guessing.',
  },
  {
    id: 'R1_relevance',
    stage: '3 · Relevance',
    title: 'Linked to your goals',
    rule: 'A product is relevant only if it contains a catalogue botanical that has at least one study measuring one of your goals.',
    why: 'Products are not recommended on general appeal.',
  },
  {
    id: 'E1_grade',
    stage: '4 · Evidence strength',
    title: 'Grading the research',
    rule: 'For each botanical preparation and goal: strong = a supporting systematic review, or two or more supporting randomised trials with none against; moderate = one supporting randomised trial and none against; conflicting = randomised trials on both sides; limited = only non-randomised human studies support it; not supported = trials found no effect; preclinical = only lab or animal work.',
    why: 'Grades are ordered categories. SkinProof does not turn research into a precise-looking score.',
  },
  {
    id: 'A1_applicability',
    stage: '4 · Formulation applicability',
    title: 'Does the product match what was studied?',
    rule: 'Close match = same preparation, same use (leave-on or rinse-off) and a stated concentration at least as high as studied. Concentration unknown = same preparation, but the brand does not state how much is in it. Weaker match = same preparation but a lower stated concentration or a different use. Different preparation = the studies used another part or form of the plant, or an isolated compound.',
    why: 'Research on an ingredient does not prove a finished product works. Concentration is never inferred from the order of the ingredient list.',
  },
  {
    id: 'Q1_qualifying_link',
    stage: '5 · Eligibility',
    title: 'At least one qualifying link',
    rule: 'To be eligible, a product needs at least one of your goals backed by human evidence (limited or better, or conflicting) on a matching preparation. Otherwise it is set aside as limited evidence.',
    why: 'Lab-only results and studies of a different preparation are shown, but they are not enough to recommend.',
  },
  {
    id: 'C1_reactive_skin',
    stage: '5 · Cautions',
    title: 'Reactive skin',
    rule: 'If you say your skin reacts easily and did not exclude them, products with fragrance, essential oils or labelled fragrance allergens get a caution.',
    why: 'You did not set a hard limit, so they are not excluded, but you should see why they might not suit you.',
  },
  {
    id: 'C2_conflicting_evidence',
    stage: '5 · Cautions',
    title: 'Studies disagree',
    rule: 'If a qualifying link rests on conflicting trials, the product gets a caution.',
    why: 'Disagreement in the research is shown, not averaged away.',
  },
  {
    id: 'C3_safety_note',
    stage: '5 · Cautions',
    title: 'Sourced safety notes',
    rule: 'If you say your skin reacts easily and a botanical in the product has a sourced safety note (for example contact allergy), the product gets a caution.',
    why: 'These notes come from dermatology sources linked in the Botanical Library.',
  },
  {
    id: 'K1_rank',
    stage: '6 · Ranking',
    title: 'Ordering the shortlist',
    rule: 'Eligible products are ordered by, in turn: no cautions; number of your goals backed by moderate or strong evidence; best evidence grade; best applicability; number of your goals backed at all; matches a product type you prefer. Products equal on all of these are shown as tied and listed alphabetically.',
    why: 'Each key is compared only when every earlier key is equal, so a preference can never outrank evidence. There are no weights to tune and no commercial inputs.',
  },
];

export function ruleDoc(id: RuleId): RuleDoc {
  const r = RULES.find((x) => x.id === id);
  if (!r) throw new Error(`Unknown rule ${id}`);
  return r;
}

/** How many products the shortlist shows. */
export const SHORTLIST_SIZE = 5;
