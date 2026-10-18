/**
 * Apply database migrations without starting the app (the app also applies
 * them on first connection).
 *
 *   npm run db:migrate
 */
import path from 'node:path';
import { openDatabase } from '../src/lib/db/client';
import { getEnv } from '../src/lib/env';

const file = path.join(getEnv().dataDir, 'skinproof.sqlite');
const { sqlite } = openDatabase(file);
const applied = sqlite.prepare('select count(*) as n from __drizzle_migrations').get() as { n: number };
console.log(`Database ${file} is up to date (${applied.n} migrations applied).`);
sqlite.close();
