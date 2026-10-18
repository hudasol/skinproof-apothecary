'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db/client';
import { profileFromForm } from '@/lib/domain/profile';
import { ImageRejectedError, type Crop } from '@/lib/images/normalize';
import { startAnalysis } from '@/lib/services/analyses';
import { deleteConsultation, recordConsent, saveProfile, savePhoto } from '@/lib/services/consultations';
import { decide } from '@/lib/services/decisions';
import { AppError } from '@/lib/services/errors';
import { log } from '@/lib/services/log';
import { startPreview } from '@/lib/services/previews';
import { currentConsultation, ensureConsultation, forgetConsultation, grantSpendAccess, requireSpendAccess } from '@/lib/session';
import type { ActionState } from './action-state';

function failure(err: unknown, values?: ActionState['values']): ActionState {
  if (err instanceof AppError) return { ok: false, message: err.message, fieldErrors: err.fieldErrors, values };
  if (err instanceof ImageRejectedError) return { ok: false, message: err.message, fieldErrors: { photo: err.message }, values };
  log('error', 'action.failed', { error: err instanceof Error ? err.message : String(err) });
  return { ok: false, message: 'Something went wrong on our side. Please try again.', values };
}

function parseCrop(raw: FormDataEntryValue | null): Crop | null {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const c = JSON.parse(raw) as Partial<Crop>;
    const n = (v: unknown) => (typeof v === 'number' ? v : Number.NaN);
    return { x: n(c.x), y: n(c.y), width: n(c.width), height: n(c.height) };
  } catch {
    return null;
  }
}

// ---------- Consent ----------

export async function consentAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const analysis = form.get('analysisConsent') === 'on';
  const preview = form.get('previewConsent') === 'on';
  if (!analysis && !preview) {
    return { ok: false, message: 'Tick at least one box to continue, or choose your goals without a photo.', fieldErrors: { analysisConsent: 'Required to analyse a photo' } };
  }
  const db = getDb();
  const c = await ensureConsultation(db);
  if (analysis) recordConsent(db, c.id, 'analysis');
  if (preview) recordConsent(db, c.id, 'preview');
  redirect(analysis ? '/consult/photo' : '/colour');
}

export async function skipPhotoAction(): Promise<void> {
  await ensureConsultation(getDb());
  redirect('/consult/goals');
}

// ---------- Photo and analysis ----------

export async function uploadPhotoAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const next = form.get('next') === 'colour' ? 'colour' : 'analysis';
  const returnTo = typeof form.get('returnTo') === 'string' ? String(form.get('returnTo')) : '/colour';
  try {
    const file = form.get('photo');
    if (!(file instanceof File) || file.size === 0) throw new AppError('invalid_input', 'Choose a photo first.', { photo: 'Choose a photo' });
    const db = getDb();
    const c = await currentConsultation(db);
    if (!c) throw new AppError('consent_required', 'Your session ended. Start the consultation again.');
    if (next === 'analysis') await requireSpendAccess();
    await savePhoto(db, c.id, new Uint8Array(await file.arrayBuffer()), parseCrop(form.get('crop')));
    if (next === 'analysis') await startAnalysis(db, c.id);
  } catch (err) {
    return failure(err);
  }
  revalidatePath('/', 'layout');
  redirect(next === 'analysis' ? '/consult/analysis' : returnTo.startsWith('/colour') ? returnTo : '/colour');
}

export async function retryAnalysisAction(_prev: ActionState): Promise<ActionState> {
  try {
    await requireSpendAccess();
    const db = getDb();
    const c = await currentConsultation(db);
    if (!c) throw new AppError('consent_required', 'Your session ended. Start the consultation again.');
    await startAnalysis(db, c.id);
  } catch (err) {
    return failure(err);
  }
  redirect('/consult/analysis');
}

// ---------- Goals and decision ----------

export async function saveProfileAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const values: ActionState['values'] = {
    goals: form.getAll('goals').map(String),
    avoidIngredients: String(form.get('avoidIngredients') ?? ''),
    flags: ['noFragrance', 'noEssentialOils', 'noFragranceAllergens', 'avoidAsteraceae', 'reactiveSkin'].filter((k) => form.get(k) === 'on'),
    preferredCategories: form.getAll('preferredCategories').map(String),
  };
  const parsed = profileFromForm(form);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const key = String(i.path[0] === 'constraints' ? i.path[1] : i.path[0]);
      fieldErrors[key] ??= i.message;
    }
    return { ok: false, message: 'Check the highlighted choices.', fieldErrors, values };
  }
  try {
    const db = getDb();
    const c = await ensureConsultation(db);
    saveProfile(db, c.id, parsed.data);
    decide(db, c.id);
  } catch (err) {
    return failure(err, values);
  }
  redirect('/shortlist');
}

// ---------- Try-on ----------

export async function previewConsentAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (form.get('previewConsent') !== 'on') return { ok: false, message: 'Tick the box to agree, or keep browsing without try-on.', fieldErrors: { previewConsent: 'Required for try-on' } };
  const db = getDb();
  const c = await ensureConsultation(db);
  recordConsent(db, c.id, 'preview');
  const back = String(form.get('returnTo') ?? '/colour');
  redirect(back.startsWith('/colour') ? back : '/colour');
}

export async function startPreviewAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireSpendAccess();
    const db = getDb();
    const c = await currentConsultation(db);
    if (!c) throw new AppError('consent_required', 'Your session ended. Agree to try-on again to continue.');
    const p = await startPreview(db, c.id, String(form.get('productId') ?? ''), String(form.get('shadeId') ?? ''));
    return { ok: true, data: { previewId: p.id } };
  } catch (err) {
    return failure(err);
  }
}

// ---------- Data and access ----------

export async function deleteMyDataAction(): Promise<void> {
  const db = getDb();
  const c = await currentConsultation(db);
  if (c) await deleteConsultation(db, c.id);
  await forgetConsultation();
  redirect('/privacy?deleted=1');
}

export async function accessCodeAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ok = await grantSpendAccess(String(form.get('code') ?? ''));
  return ok ? { ok: true, message: 'Access granted for this browser for 7 days.' } : { ok: false, message: 'That code is not right.', fieldErrors: { code: 'Not recognised' } };
}
