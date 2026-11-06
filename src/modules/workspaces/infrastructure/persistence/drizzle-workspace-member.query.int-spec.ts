import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { inject } from 'vitest';

import { DatabaseContext } from '@common/database';
import { newUuidV7 } from '@common/primitives';
import { TenantId } from '@modules/tenants';
import { UserId } from '@modules/users';

import { Workspace } from '../../domain/entities/workspace.js';
import { WorkspaceId } from '../../domain/value-objects/workspace-id.js';
import { WorkspaceName } from '../../domain/value-objects/workspace-name.js';
import { SystemRoleId } from '../../domain/value-objects/system-workspace-role.js';
import type { WorkspaceRoleId } from '../../domain/value-objects/workspace-role-id.js';
import { restoreSystemRoles } from '../../testing/system-roles.js';
import { DrizzleWorkspaceMemberQuery } from './drizzle-workspace-member.query.js';
import { DrizzleWorkspaceRepository } from './drizzle-workspace.repository.js';

const pool = new Pool({ connectionString: inject('databaseUrl') });
const context = new DatabaseContext(drizzle(pool));
const workspaces = new DrizzleWorkspaceRepository(context);
const query = new DrizzleWorkspaceMemberQuery(context);

const insertTenant = async (): Promise<TenantId> => {
  const id = TenantId.generate();
  await pool.query("INSERT INTO tenants (id, name) VALUES ($1, 'T')", [id]);
  return id;
};

const insertUser = async (tenantId: TenantId, email: string, name: string): Promise<UserId> => {
  const id = UserId.generate();
  await pool.query('INSERT INTO users (id, tenant_id, email, name) VALUES ($1, $2, $3, $4)', [
    id,
    tenantId,
    email,
    name,
  ]);
  return id;
};

beforeEach(async () => {
  await pool.query('TRUNCATE TABLE outbox, workspace_members, workspaces, users, tenants CASCADE');
  await restoreSystemRoles(pool);
});

afterAll(async () => {
  await pool.end();
});

// INFO: Members get explicit created_at values (one minute apart, owner first) so the order is deterministic.
const seedWorkspace = async (
  extraMembers: number,
): Promise<{ tenantId: TenantId; workspaceId: WorkspaceId; owner: UserId; added: UserId[] }> => {
  const tenantId = await insertTenant();
  const owner = await insertUser(tenantId, 'o@a.co', 'Olive');
  const workspace = Workspace.create({
    tenantId,
    name: WorkspaceName.create('Acme'),
    ownerId: owner,
    createdAt: new Date(),
  });
  await workspaces.save(workspace);
  const start = Date.now();
  const insertMember = (userId: UserId, roleId: WorkspaceRoleId, createdAt: Date) =>
    pool.query(
      'INSERT INTO workspace_members (id, tenant_id, workspace_id, user_id, role_id, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [newUuidV7(), tenantId, workspace.id, userId, roleId, createdAt],
    );
  await insertMember(owner, SystemRoleId.OWNER, new Date(start));
  const added: UserId[] = [];
  for (let index = 0; index < extraMembers; index++) {
    const userId = await insertUser(tenantId, `m${index}@a.co`, `Member ${index}`);
    await insertMember(userId, SystemRoleId.ADMIN, new Date(start + (index + 1) * 60_000));
    added.push(userId);
  }
  return { tenantId, workspaceId: workspace.id, owner, added };
};

describe('DrizzleWorkspaceMemberQuery', () => {
  it('pages the members newest first with the total', async () => {
    const { tenantId, workspaceId, owner, added } = await seedWorkspace(4);
    const newestFirst = [...added.reverse(), owner];
    const page = (number: number) =>
      query.list({ tenantId, workspaceId, actorId: owner, page: number, limit: 2 });

    const first = await page(1);
    const second = await page(2);
    const last = await page(3);
    const beyond = await page(4);

    expect(first?.total).toBe(5);
    expect(first?.items.map((member) => member.userId)).toEqual(newestFirst.slice(0, 2));
    expect(first?.items[0]).toEqual({
      userId: newestFirst[0],
      name: 'Member 3',
      email: 'm3@a.co',
      roleId: SystemRoleId.ADMIN,
      role: 'admin',
    });
    expect(second?.items.map((member) => member.userId)).toEqual(newestFirst.slice(2, 4));
    expect(last?.items.map((member) => member.userId)).toEqual(newestFirst.slice(4));
    expect(beyond).toEqual({ items: [], total: 5 });
  });

  it('returns null for a non-member, an unknown workspace and a workspace of another tenant', async () => {
    const { tenantId, workspaceId, owner } = await seedWorkspace(0);
    const outsider = await insertUser(tenantId, 'x@a.co', 'Xena');
    const otherTenantId = await insertTenant();
    const list = (params: { tenantId: TenantId; workspaceId: WorkspaceId; actorId: UserId }) =>
      query.list({ ...params, page: 1, limit: 20 });

    expect(await list({ tenantId, workspaceId, actorId: outsider })).toBeNull();
    expect(
      await list({ tenantId, workspaceId: WorkspaceId.generate(), actorId: owner }),
    ).toBeNull();
    expect(await list({ tenantId: otherTenantId, workspaceId, actorId: owner })).toBeNull();
  });
});
