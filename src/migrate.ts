import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

import { checkConfigOrExit, loadEnvFiles } from '@common/config';
import { databaseConfig } from '@common/database';

import { MIGRATE_CONFIGS } from './config-sets.js';
import { runEntrypoint } from './run-entrypoint.js';

const MIGRATIONS_FOLDER = './drizzle';

async function run(): Promise<void> {
  loadEnvFiles();
  checkConfigOrExit(MIGRATE_CONFIGS);
  const pool = new Pool({ connectionString: databaseConfig().url, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await pool.end();
  }
}

await runEntrypoint('Migrate', run);
