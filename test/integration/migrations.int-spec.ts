import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { inject } from 'vitest';

import { newUuidV7 } from '@common/primitives';

const MIGRATIONS_FOLDER = './drizzle';
const LAST_MIGRATION_BEFORE_DATA_CHANGES = 8;
const byTenant = (a: { tenant_id: string }, b: { tenant_id: string }): number =>
  a.tenant_id.localeCompare(b.tenant_id);
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

type Journal = {
  entries: { idx: number; tag: string }[];
};

const admin = new Pool({ connectionString: inject('databaseUrl') });
const pools: Pool[] = [];
const databases: string[] = [];
const folders: string[] = [];

// A copy of the migrations folder that stops after the given migration.
const migrationsUpTo = async (lastIdx: number): Promise<string> => {
  const folder = await mkdtemp(join(tmpdir(), 'boilerplate-migrations-'));
  folders.push(folder);
  await mkdir(join(folder, 'meta'));
  const journal = JSON.parse(
    await readFile(join(MIGRATIONS_FOLDER, 'meta', '_journal.json'), 'utf8'),
  ) as Journal;
  const entries = journal.entries.filter((entry) => entry.idx <= lastIdx);
  await writeFile(join(folder, 'meta', '_journal.json'), JSON.stringify({ ...journal, entries }));
  for (const { tag } of entries) {
    await copyFile(join(MIGRATIONS_FOLDER, `${tag}.sql`), join(folder, `${tag}.sql`));
  }
  return folder;
};

// A new empty database migrated up to migration `lastIdx`, to be filled with "existing" data.
const databaseAt = async (lastIdx: number): Promise<Pool> => {
  const name = `migration_${newUuidV7().replaceAll('-', '')}`;
  await admin.query(`CREATE DATABASE ${name}`);
  databases.push(name);
  const url = new URL(inject('databaseUrl'));
  url.pathname = `/${name}`;
  const pool = new Pool({ connectionString: url.toString() });
  pools.push(pool);
  await migrate(drizzle(pool), { migrationsFolder: await migrationsUpTo(lastIdx) });
  return pool;
};

const insertTenant = async (pool: Pool, name: string): Promise<string> => {
  const id = newUuidV7();
  await pool.query('INSERT INTO tenants (id, name, slug) VALUES ($1, $2, $3)', [id, name, name]);
  return id;
};

const insertUser = async (pool: Pool, tenantId: string, email: string): Promise<string> => {
  const id = newUuidV7();
  await pool.query("INSERT INTO users (id, tenant_id, email, name) VALUES ($1, $2, $3, 'U')", [
    id,
    tenantId,
    email,
  ]);
  return id;
};

afterAll(async () => {
  await Promise.all(pools.map((pool) => pool.end()));
  for (const name of databases) {
    await admin.query(`DROP DATABASE ${name}`);
  }
  await admin.end();
  await Promise.all(folders.map((folder) => rm(folder, { recursive: true, force: true })));
});

describe('migrations on existing data', () => {
  it('gives each tenant with users a workspace owned by them, and no workspace to an empty tenant', async () => {
    const pool = await databaseAt(LAST_MIGRATION_BEFORE_DATA_CHANGES);
    const acme = await insertTenant(pool, 'Acme');
    await insertTenant(pool, 'Empty');
    const first = await insertUser(pool, acme, 'a@acme.co');
    const second = await insertUser(pool, acme, 'b@acme.co');
    const beta = await insertTenant(pool, 'Beta');
    const third = await insertUser(pool, beta, 'a@beta.co');

    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_FOLDER });

    const workspaces = await pool.query<{ id: string; tenant_id: string; name: string }>(
      'SELECT id, tenant_id, name FROM workspaces',
    );
    expect(
      workspaces.rows.map((row) => ({ tenant_id: row.tenant_id, name: row.name })).sort(byTenant),
    ).toEqual(
      [
        { tenant_id: acme, name: 'Acme' },
        { tenant_id: beta, name: 'Beta' },
      ].sort(byTenant),
    );
    expect(workspaces.rows.every((row) => UUID_V7.test(row.id))).toBe(true);
    expect(new Set(workspaces.rows.map((row) => row.id)).size).toBe(2);
    const members = await pool.query<{ user_id: string; role: string }>(
      'SELECT user_id, role FROM workspace_members ORDER BY user_id',
    );
    expect(members.rows).toEqual(
      [first, second, third].sort().map((userId) => ({ user_id: userId, role: 'owner' })),
    );
  });

  it('stops with a readable error when two tenants share an email', async () => {
    const pool = await databaseAt(LAST_MIGRATION_BEFORE_DATA_CHANGES);
    await insertUser(pool, await insertTenant(pool, 'Acme'), 'same@x.co');
    await insertUser(pool, await insertTenant(pool, 'Beta'), 'same@x.co');

    await expect(migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_FOLDER })).rejects.toThrow(
      /several tenants/,
    );

    const { rows } = await pool.query(
      "SELECT 1 FROM pg_indexes WHERE indexname = 'uq_users_email'",
    );
    expect(rows).toHaveLength(0);
  });
});
