import { resolve } from 'node:path';

import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

export const runMigrate = (db: BetterSQLite3Database<Record<string, unknown>>): void => {
  console.log('⏳ Running migrations...');

  const start = Date.now();

  let updateFolder: string;
  if (import.meta.env.PROD) {
    updateFolder = resolve(process.resourcesPath, 'chat', 'db', 'migrations');
  } else {
    // get current folder
    const currentFolder = resolve(__dirname);
    updateFolder = resolve(currentFolder, '..', 'src', 'chat', 'db', 'migrations');
  }

  const cleanedPath = updateFolder.replace('/[project]', '');

  migrate(db, { migrationsFolder: cleanedPath });
  const end = Date.now();

  console.log('✅ Migrations completed in', end - start, 'ms');
};
