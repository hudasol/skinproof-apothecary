import fs from 'node:fs/promises';
import path from 'node:path';
import { count } from 'drizzle-orm';
import { getCatalogue, getCatalogueVersion } from '@/lib/catalogue';
import { getDb } from '@/lib/db/client';
import { consultations } from '@/lib/db/schema';
import { getEnv } from '@/lib/env';
import { RULE_VERSION } from '@/lib/ledger/rules';
import { providerState } from '@/lib/providers';

export const runtime = 'nodejs';

/** Liveness and configuration. Reports configuration, never secret values. */
export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};
  try {
    const n = getDb().select({ n: count() }).from(consultations).get()?.n ?? 0;
    checks.database = { ok: true, detail: `${n} consultations` };
  } catch {
    checks.database = { ok: false, detail: 'Database not reachable' };
  }
  try {
    const dir = path.join(getEnv().dataDir, 'artifacts');
    await fs.mkdir(dir, { recursive: true });
    await fs.access(dir, fs.constants.W_OK);
    checks.imageStore = { ok: true };
  } catch {
    checks.imageStore = { ok: false, detail: 'Image directory is not writable' };
  }
  try {
    const c = getCatalogue();
    checks.catalogue = { ok: true, detail: `${getCatalogueVersion()}: ${c.products.length} products, ${c.studies.length} studies` };
  } catch {
    checks.catalogue = { ok: false, detail: 'Catalogue failed validation' };
  }
  const provider = providerState();
  checks.provider = provider.ready ? { ok: true, detail: `${provider.mode} mode` } : { ok: false, detail: provider.problem };
  const ok = Object.values(checks).every((c) => c.ok);
  return Response.json({ ok, providerMode: provider.mode, ruleVersion: RULE_VERSION, checks }, { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
}
