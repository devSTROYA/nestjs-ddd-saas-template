import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { z } from 'zod';

import { loadEnvFiles } from '@common/config';

const MIGRATIONS_FOLDER = './drizzle';

async function run(): Promise<void> {
  loadEnvFiles();
  const { DATABASE_URL } = z.object({ DATABASE_URL: z.url() }).parse(process.env);
  const pool = new Pool({ connectionString: DATABASE_URL, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await pool.end();
  }
}

await run();
