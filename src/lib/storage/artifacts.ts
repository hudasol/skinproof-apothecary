import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import { eq, inArray } from 'drizzle-orm';
import { artifacts, type Artifact, type Provenance } from '../db/schema';
import type { Db } from '../db/client';
import { sha256Hex } from '../domain/canonical';
import { newId } from '../domain/ids';
import { getEnv } from '../env';

/**
 * Images on disk, content-addressed (ported from TryOn TD-4). Storage keys
 * come only from the content hash, so user input never reaches a path.
 * Reading verifies the hash. Deleting removes the file only when no other
 * record still points at the same bytes.
 */

const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png' };

export class ArtifactIntegrityError extends Error {
  constructor(message: string, readonly artifactId: string) {
    super(message);
    this.name = 'ArtifactIntegrityError';
  }
}

function root(): string {
  return path.join(getEnv().dataDir, 'artifacts');
}

function storageKeyFor(sha: string, mimeType: string): string {
  const ext = EXTENSIONS[mimeType];
  if (!ext) throw new Error(`Unsupported artifact type ${mimeType}`);
  return `${sha.slice(0, 2)}/${sha}.${ext}`;
}

function resolveKey(key: string): string {
  if (!/^[0-9a-f]{2}\/[0-9a-f]{64}\.(jpg|png)$/.test(key)) throw new Error('Malformed storage key');
  return path.join(root(), key);
}

export type NewArtifact = {
  consultationId: string | null;
  kind: Artifact['kind'];
  provenance: Provenance;
  data: Uint8Array;
  mimeType: 'image/jpeg' | 'image/png';
  width?: number | null;
  height?: number | null;
};

export async function putArtifact(db: Db, input: NewArtifact): Promise<Artifact> {
  const sha = sha256Hex(input.data);
  const key = storageKeyFor(sha, input.mimeType);
  const file = resolveKey(key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  try {
    await fs.access(file);
  } catch {
    // Write to a temp file first so a crash never leaves a truncated artifact.
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, input.data);
    await fs.rename(tmp, file);
  }
  const row: Artifact = {
    id: newId('artifact'),
    consultationId: input.consultationId,
    kind: input.kind,
    provenance: input.provenance,
    sha256: sha,
    storageKey: key,
    mimeType: input.mimeType,
    bytes: input.data.byteLength,
    width: input.width ?? null,
    height: input.height ?? null,
    createdAt: new Date(),
  };
  db.insert(artifacts).values(row).run();
  return row;
}

export async function readArtifact(artifact: Artifact): Promise<Buffer> {
  let data: Buffer;
  try {
    data = await fs.readFile(resolveKey(artifact.storageKey));
  } catch {
    throw new ArtifactIntegrityError('Artifact file is missing', artifact.id);
  }
  if (sha256Hex(data) !== artifact.sha256) throw new ArtifactIntegrityError('Artifact file does not match its recorded hash', artifact.id);
  return data;
}

/** Delete artifact rows, then any file no remaining row refers to. Returns files removed. */
export async function deleteArtifacts(db: Db, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const rows = db.select().from(artifacts).where(inArray(artifacts.id, ids)).all();
  db.delete(artifacts).where(inArray(artifacts.id, ids)).run();
  return removeOrphanFiles(db, rows);
}

/** After rows were removed (e.g. by a cascade), delete files nothing points at any more. */
export async function removeOrphanFiles(db: Db, removed: Pick<Artifact, 'sha256' | 'storageKey'>[]): Promise<number> {
  let n = 0;
  for (const key of new Set(removed.map((r) => r.storageKey))) {
    const sha = removed.find((r) => r.storageKey === key)!.sha256;
    const still = db.select({ id: artifacts.id }).from(artifacts).where(eq(artifacts.sha256, sha)).get();
    if (still) continue;
    try {
      await fs.unlink(resolveKey(key));
      n++;
    } catch {
      // Already gone.
    }
  }
  return n;
}
