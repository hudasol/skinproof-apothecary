'use client';

import { useActionState, useState } from 'react';
import { saveProfileAction } from '@/app/actions';
import { initialState } from '@/app/action-state';
import { CATEGORY_LABELS, type ConsultationProfile, type ProductCategory } from '@/lib/domain/profile';
import { GOAL_LABELS, GOALS, type Goal } from '@/lib/domain/skin';
import { FieldError, FormMessage, SubmitButton } from './bits';

type Suggestion = { goal: Goal; reason: string };

const CONSTRAINTS = [
  { name: 'noFragrance', label: 'No added fragrance', detail: 'Excludes labels listing Parfum, Fragrance, Aroma or Flavor, and scent materials such as Vanillin.' },
  { name: 'noEssentialOils', label: 'No essential oils', detail: 'Excludes products with oils such as lavender, peppermint, tea tree or citrus peel. Pressed seed oils are not affected.' },
  { name: 'noFragranceAllergens', label: 'No labelled fragrance allergens', detail: 'Excludes products naming any of the 26 allergens EU law requires on labels, such as Limonene and Linalool.' },
  { name: 'avoidAsteraceae', label: 'Avoid the daisy family', detail: 'Excludes chamomile, calendula, arnica, feverfew, sunflower and other Asteraceae plants.' },
] as const;

export function ProfileForm({ profile, suggestions, categories }: { profile: ConsultationProfile | null; suggestions: Suggestion[]; categories: ProductCategory[] }) {
  const [state, action] = useActionState(saveProfileAction, initialState);
  const v = state.values;
  const initialGoals: Goal[] = (v?.goals as Goal[] | undefined) ?? profile?.goals ?? suggestions.map((s) => s.goal);
  const [goals, setGoals] = useState<Goal[]>(initialGoals);
  const flags = new Set<string>(
    (v?.flags as string[] | undefined) ??
      (profile
        ? [
            ...Object.entries(profile.constraints)
              .filter(([k, val]) => val === true && k !== 'avoidIngredients')
              .map(([k]) => k),
            ...(profile.reactiveSkin ? ['reactiveSkin'] : []),
          ]
        : []),
  );
  const prefs = new Set<string>((v?.preferredCategories as string[] | undefined) ?? profile?.preferredCategories ?? []);
  const avoid = (v?.avoidIngredients as string | undefined) ?? profile?.constraints.avoidIngredients.join('\n') ?? '';
  const fe = state.fieldErrors ?? {};
  const suggested = new Map(suggestions.map((s) => [s.goal, s.reason]));
  const ordered = [...suggestions.map((s) => s.goal), ...GOALS.filter((g) => !suggested.has(g))];

  function toggle(g: Goal) {
    setGoals((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]));
  }

  return (
    <form action={action} noValidate>
      <FormMessage state={state} />
      {suggestions.map((s) => (
        <input key={s.goal} type="hidden" name="suggestedGoals" value={s.goal} />
      ))}

      <fieldset aria-describedby="goals-hint">
        <legend>What would you like your skincare to do?</legend>
        <p className="hint" id="goals-hint">
          Choose up to three. {suggestions.length ? 'The ticked ones come from your analysis; change them freely.' : ''}
        </p>
        <div className="choice-list">
          {ordered.map((g) => (
            <label key={g} className="choice">
              <input
                type="checkbox"
                name="goals"
                value={g}
                checked={goals.includes(g)}
                onChange={() => toggle(g)}
                disabled={!goals.includes(g) && goals.length >= 3}
              />
              <span>
                <strong>{GOAL_LABELS[g].label}</strong>
                {suggested.has(g) && <span className="small">Suggested by your analysis: {suggested.get(g)}</span>}
              </span>
            </label>
          ))}
        </div>
        <p className="small" aria-live="polite">
          {goals.length} of 3 chosen.
        </p>
        <FieldError message={fe.goals} />
      </fieldset>

      <fieldset aria-describedby="excl-hint">
        <legend>Anything to rule out?</legend>
        <p className="hint" id="excl-hint">
          These are hard limits. A product that breaks one is excluded, whatever its evidence, and is never offered for try-on.
        </p>
        <div className="choice-list">
          {CONSTRAINTS.map((c) => (
            <label key={c.name} className="choice">
              <input type="checkbox" name={c.name} defaultChecked={flags.has(c.name)} />
              <span>
                <strong>{c.label}</strong>
                <span className="small">{c.detail}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="field" style={{ marginTop: 'var(--space-4)' }}>
          <label htmlFor="avoidIngredients">Other ingredients to avoid</label>
          <textarea
            id="avoidIngredients"
            name="avoidIngredients"
            className="input"
            defaultValue={avoid}
            placeholder={'One per line, as written on labels, for example:\nAlcohol Denat.\nLanolin'}
            aria-describedby="avoid-hint"
            aria-invalid={!!fe.avoidIngredients}
          />
          <span className="hint" id="avoid-hint">
            Matched as whole words against every ingredient on the label, ignoring capitals. Up to ten.
          </span>
          <FieldError message={fe.avoidIngredients} />
        </div>
      </fieldset>

      <fieldset>
        <legend>Anything else?</legend>
        <div className="choice-list">
          <label className="choice">
            <input type="checkbox" name="reactiveSkin" defaultChecked={flags.has('reactiveSkin')} />
            <span>
              <strong>My skin reacts easily</strong>
              <span className="small">
                Not an exclusion. Products with fragrance, essential oils or a botanical with a known allergy note get a caution.
              </span>
            </span>
          </label>
        </div>
        <p className="hint" style={{ marginTop: 'var(--space-4)' }}>
          Product types you prefer (only used to order products that are otherwise equal):
        </p>
        <div className="choice-list" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(10rem, 1fr))' }}>
          {categories.map((c) => (
            <label key={c} className="choice">
              <input type="checkbox" name="preferredCategories" value={c} defaultChecked={prefs.has(c)} />
              <span>
                <strong>{CATEGORY_LABELS[c]}</strong>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="actions">
        <SubmitButton pending="Checking every product…" disabled={goals.length === 0}>
          Show my shortlist
        </SubmitButton>
      </div>
    </form>
  );
}
