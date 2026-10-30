import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import EmbeddedPostgres from 'embedded-postgres';
import { Pool } from 'pg';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

const DATABASE_NAME = 'test';
const USER = 'postgres';
const PASSWORD = 'postgres';

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, () => {
      const address = server.address();
      server.close(() => {
        if (typeof address === 'object' && address !== null) {
          resolve(address.port);
        } else {
          reject(new Error('Could not determine a free port'));
        }
      });
    });
  });
}

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const databaseDir = await mkdtemp(join(tmpdir(), 'boilerplate-pg-'));
  const port = await findFreePort();
  const postgres = new EmbeddedPostgres({
    databaseDir,
    port,
    user: USER,
    password: PASSWORD,
    persistent: false,
    onLog: () => {},
    onError: () => {},
  });

  await postgres.initialise();
  await postgres.start();
  await postgres.createDatabase(DATABASE_NAME);

  const databaseUrl = `postgres://${USER}:${PASSWORD}@localhost:${port}/${DATABASE_NAME}`;
  const pool = new Pool({ connectionString: databaseUrl });
  await migrate(drizzle(pool), { migrationsFolder: './drizzle' });
  await pool.end();

  project.provide('databaseUrl', databaseUrl);

  return async () => {
    await postgres.stop();
    await rm(databaseDir, { recursive: true, force: true });
  };
}
