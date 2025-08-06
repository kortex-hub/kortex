import { config } from 'dotenv';

import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { resolve } from 'node:path';

config({
  path: '.env.local',
});

export const runMigrate = async (db: BetterSQLite3Database<Record<string, unknown>>) => {
  console.log('⏳ Running migrations...');

  const start = Date.now();

  // get current folder
  const currentFolder = resolve(__dirname);

  const updateFolder = resolve(currentFolder, '..', 'migrations');

  const cleanedPath = updateFolder.replace('/[project]', '');

  await migrate(db, { migrationsFolder: cleanedPath });
  const end = Date.now();

  console.log('✅ Migrations completed in', end - start, 'ms');
};
