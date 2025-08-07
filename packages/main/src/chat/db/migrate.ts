import { resolve } from 'node:path';

import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

export const runMigrate = (db: BetterSQLite3Database<Record<string, unknown>>): void => {
  console.log('⏳ Running migrations...');

  const start = Date.now();

  // get current folder
  const currentFolder = resolve(__dirname);

  const updateFolder = resolve(currentFolder, '..', 'migrations');

  const cleanedPath = updateFolder.replace('/[project]', '');

  migrate(db, { migrationsFolder: cleanedPath });
  const end = Date.now();

  console.log('✅ Migrations completed in', end - start, 'ms');
};
