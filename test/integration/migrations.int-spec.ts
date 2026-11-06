import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { inject } from 'vitest';

import { newUuidV7 } from '@common/primitives';
import { SystemRoleId } from '@modules/workspaces';

import { SYSTEM_ROLES } from '../../src/modules/workspaces/testing/system-roles.js';

const MIGRATIONS_FOLDER = './drizzle';
const LAST_MIGRATION_BEFORE_DATA_CHANGES = 8;
const LAST_MIGRATION_BEFORE_ROLES = 12;
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
      `SELECT m.user_id, r.key AS role
       FROM workspace_members m JOIN workspace_roles r ON r.id = m.role_id
       ORDER BY m.user_id`,
    );
    expect(members.rows).toEqual(
      [first, second, third].sort().map((userId) => ({ user_id: userId, role: 'owner' })),
    );
    const memberIds = await pool.query<{ id: string; tenant_id: string; user_tenant_id: string }>(
      `SELECT m.id, m.tenant_id, u.tenant_id AS user_tenant_id
       FROM workspace_members m JOIN users u ON u.id = m.user_id`,
    );
    expect(memberIds.rows).toHaveLength(3);
    expect(memberIds.rows.every((row) => UUID_V7.test(row.id))).toBe(true);
    expect(new Set(memberIds.rows.map((row) => row.id)).size).toBe(3);
    expect(memberIds.rows.every((row) => row.tenant_id === row.user_tenant_id)).toBe(true);
  });

  it('seeds the system roles the code expects, with no workspace and no tenant', async () => {
    const pool = await databaseAt(LAST_MIGRATION_BEFORE_ROLES);

    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_FOLDER });

    const roles = await pool.query<{
      id: string;
      key: string;
      name: string;
      tenant_id: string | null;
      workspace_id: string | null;
      permissions: string[];
    }>(
      `SELECT r.id, r.key, r.name, r.tenant_id, r.workspace_id,
              coalesce(array_agg(p.permission ORDER BY p.permission)
                       FILTER (WHERE p.permission IS NOT NULL), '{}') AS permissions
       FROM workspace_roles r
       LEFT JOIN workspace_role_permissions p ON p.role_id = r.id
       GROUP BY r.id ORDER BY r.id`,
    );
    expect(roles.rows).toEqual(
      SYSTEM_ROLES.map(({ id, key, name, permissions }) => ({
        id: id,
        key,
        name,
        tenant_id: null,
        workspace_id: null,
        permissions: [...permissions].sort(),
      })),
    );
  });

  it('moves existing members to the system role with the same key', async () => {
    const pool = await databaseAt(LAST_MIGRATION_BEFORE_ROLES);
    const tenantId = newUuidV7();
    await pool.query("INSERT INTO tenants (id, name) VALUES ($1, 'Acme')", [tenantId]);
    const owner = await insertUser(pool, tenantId, 'o@acme.co');
    const admin = await insertUser(pool, tenantId, 'a@acme.co');
    const workspaceId = newUuidV7();
    await pool.query("INSERT INTO workspaces (id, tenant_id, name) VALUES ($1, $2, 'Acme')", [
      workspaceId,
      tenantId,
    ]);
    for (const [userId, role] of [
      [owner, 'owner'],
      [admin, 'admin'],
    ]) {
      await pool.query(
        'INSERT INTO workspace_members (id, tenant_id, workspace_id, user_id, role) VALUES ($1, $2, $3, $4, $5)',
        [newUuidV7(), tenantId, workspaceId, userId, role],
      );
    }

    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_FOLDER });

    const { rows } = await pool.query<{ user_id: string; role_id: string }>(
      'SELECT user_id, role_id FROM workspace_members',
    );
    expect(rows).toEqual(
      expect.arrayContaining([
        { user_id: owner, role_id: SystemRoleId.OWNER },
        { user_id: admin, role_id: SystemRoleId.ADMIN },
      ]),
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
