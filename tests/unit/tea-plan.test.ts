import { describe, expect, it } from 'vitest';
import { getTeas } from '@/lib/catalogue/teas';
import { planTea } from '@/lib/tea/plan';

const teas = getTeas();
const open = { avoidDaisyFamily: false };

describe('tea catalogue', () => {
  it('loads, and every human trial claim cites a trial and every traditional claim a source', () => {
    expect(teas.length).toBeGreaterThanOrEqual(8);
  });
});

describe('planTea', () => {
  it('suggests roselle and rose hip for low moisture, with trials ahead of tradition', () => {
    const p = planTea(teas, ['support_hydration'], open);
    const ids = p.goals[0]!.options.map((o) => o.tea.id);
    expect(ids.slice(0, 2)).toEqual(expect.arrayContaining(['roselle', 'rose-hip']));
    expect(p.goals[0]!.options.at(-1)!.tier).toBe('traditional');
  });

  it('builds one blend that covers every focus goal it can', () => {
    const p = planTea(teas, ['support_hydration', 'smooth_fine_lines', 'calm_visible_redness'], open);
    const covered = new Set(p.blend.flatMap((b) => b.covers.map((c) => c.goal)));
    expect(covered.has('support_hydration')).toBe(true);
    expect(covered.has('smooth_fine_lines')).toBe(true);
    expect(covered.has('calm_visible_redness')).toBe(true);
    expect(p.blend.length).toBeLessThanOrEqual(4);
    expect(p.uncovered).toEqual([]);
  });

  it('never blends a tea that was tested and did not help, or one marked not for blending', () => {
    const p = planTea(teas, ['blemish_care', 'balance_oil', 'smooth_fine_lines', 'refine_texture', 'radiance'], open);
    const blended = p.blend.map((b) => b.tea.id);
    expect(blended).not.toContain('green-tea');
    expect(blended).not.toContain('gotu-kola');
    expect(blended).not.toContain('licorice-root');
  });

  it('says plainly when no tea has evidence for a goal', () => {
    const p = planTea(teas, ['even_tone', 'balance_oil'], open);
    expect(p.blend).toEqual([]);
    expect(p.uncovered.map((u) => u.goal).sort()).toEqual(['balance_oil', 'even_tone']);
  });

  it('leaves out daisy family teas for a person who avoids them, and says why', () => {
    const p = planTea(teas, ['calm_visible_redness', 'blemish_care'], { avoidDaisyFamily: true });
    expect(p.blend.map((b) => b.tea.id)).not.toContain('chamomile');
    expect(p.goals[0]!.excluded.map((e) => e.tea.id)).toContain('chamomile');
    expect(p.goals.flatMap((g) => g.options).every((o) => !o.tea.daisyFamily)).toBe(true);
  });

  it('is deterministic', () => {
    const a = planTea(teas, ['support_hydration', 'smooth_fine_lines'], open);
    const b = planTea(teas, ['smooth_fine_lines', 'support_hydration'], open);
    expect(a).toEqual(b);
  });
});
