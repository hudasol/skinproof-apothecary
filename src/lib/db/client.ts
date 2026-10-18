import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';
import { getEnv } from '../env';

export type Db = BetterSQLite3Database<typeof schema>;

const MIGRATIONS_DIR = path.join(process.cwd(), 'drizzle');

export function openDatabase(file: string): { db: Db; sqlite: Database.Database } {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  return { db, sqlite };
}

// Survive Next.js dev hot reloads without opening a second connection.
const globalForDb = globalThis as unknown as { __skinproofDb?: { db: Db; sqlite: Database.Database } };

export function getDb(): Db {
  if (!globalForDb.__skinproofDb) {
    globalForDb.__skinproofDb = openDatabase(path.join(getEnv().dataDir, 'skinproof.sqlite'));
  }
  return globalForDb.__skinproofDb.db;
}

/** Test hook: use a specific database for the rest of the process. */
export function setDbForTesting(handle: { db: Db; sqlite: Database.Database } | undefined): void {
  globalForDb.__skinproofDb = handle;
}
