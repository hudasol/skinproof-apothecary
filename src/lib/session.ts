import 'server-only';
import { cookies } from 'next/headers';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Db } from './db/client';
import type { Consultation } from './db/schema';
import { isValidId } from './domain/ids';
import { getEnv } from './env';
import { createConsultation, getConsultation } from './services/consultations';
import { AppError } from './services/errors';

/**
 * One anonymous consultation per browser, identified by a random id in an
 * httpOnly cookie. There are no accounts. Writing the cookie is only
 * possible in server actions and route handlers.
 */

export const CONSULTATION_COOKIE = 'sp_consultation';
export const ACCESS_COOKIE = 'sp_access';

export async function currentConsultationId(): Promise<string | null> {
  const v = (await cookies()).get(CONSULTATION_COOKIE)?.value;
  return v && isValidId(v, 'consultation') ? v : null;
}

export async function currentConsultation(db: Db): Promise<Consultation | null> {
  const id = await currentConsultationId();
  return id ? getConsultation(db, id) : null;
}

/** Server actions only: return the current consultation, creating one if needed. */
export async function ensureConsultation(db: Db): Promise<Consultation> {
  const existing = await currentConsultation(db);
  if (existing) return existing;
  const c = createConsultation(db);
  (await cookies()).set(CONSULTATION_COOKIE, c.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && process.env.SKINPROOF_INSECURE_COOKIES !== '1',
    path: '/',
    expires: c.expiresAt,
  });
  return c;
}

export async function forgetConsultation(): Promise<void> {
  (await cookies()).delete(CONSULTATION_COOKIE);
}

// Optional access code for hosted demos (TryOn TD-11): it gates live spending, not reading.

function digest(value: string): Buffer {
  return createHash('sha256').update(`skinproof:${value}`).digest();
}

export async function hasSpendAccess(): Promise<boolean> {
  const env = getEnv();
  if (env.providerMode !== 'live' || !env.accessCode) return true;
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return false;
  return timingSafeEqual(Buffer.from(token, 'hex'), digest(env.accessCode));
}

export async function requireSpendAccess(): Promise<void> {
  if (!(await hasSpendAccess())) {
    throw new AppError('not_allowed', 'This hosted demo needs an access code before it calls YouCam. Enter it on the System page.');
  }
}

export async function grantSpendAccess(candidate: string): Promise<boolean> {
  const code = getEnv().accessCode;
  if (!code) return true;
  if (!timingSafeEqual(digest(candidate), digest(code))) return false;
  (await cookies()).set(ACCESS_COOKIE, digest(code).toString('hex'), { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 });
  return true;
}
