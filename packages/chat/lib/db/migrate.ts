import { config } from 'dotenv';

import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

config({
  path: '.env.local',
});

export const runMigrate = async (db: BetterSQLite3Database<Record<string, unknown>>) => {
  console.log('⏳ Running migrations...');

  const start = Date.now();
  await migrate(db, { migrationsFolder: './lib/db/migrations' });
  const end = Date.now();

  console.log('✅ Migrations completed in', end - start, 'ms');
};
