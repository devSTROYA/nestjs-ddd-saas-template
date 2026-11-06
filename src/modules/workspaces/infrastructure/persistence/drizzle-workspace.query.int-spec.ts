import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { inject } from 'vitest';

import { DatabaseContext } from '@common/database';
import { newUuidV7 } from '@common/primitives';
import { TenantId } from '@modules/tenants';
import { UserId } from '@modules/users';

import { Workspace } from '../../domain/entities/workspace.js';
import { WORKSPACE_VIEW_MEMBER_LIMIT } from '../../application/ports/workspace.query.js';
import { WorkspaceId } from '../../domain/value-objects/workspace-id.js';
import { WorkspaceName } from '../../domain/value-objects/workspace-name.js';
import { SystemRoleId } from '../../domain/value-objects/system-workspace-role.js';
import type { WorkspaceRoleId } from '../../domain/value-objects/workspace-role-id.js';
import { restoreSystemRoles } from '../../testing/system-roles.js';
import { DrizzleWorkspaceQuery } from './drizzle-workspace.query.js';
import { DrizzleWorkspaceRepository } from './drizzle-workspace.repository.js';

const pool = new Pool({ connectionString: inject('databaseUrl') });
const context = new DatabaseContext(drizzle(pool));
const repository = new DrizzleWorkspaceRepository(context);
const query = new DrizzleWorkspaceQuery(context);

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
  await repository.save(workspace);
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

describe('DrizzleWorkspaceQuery', () => {
  it('returns the workspace with its members, their name and email, and the role of the actor', async () => {
    const { tenantId, workspaceId, owner, added } = await seedWorkspace(1);
    const [admin] = added;

    const view = await query.findDetailFor(tenantId, workspaceId, admin as UserId);

    expect(view).toEqual({
      id: workspaceId,
      name: 'Acme',
      roleId: SystemRoleId.ADMIN,
      role: 'admin',
      memberCount: 2,
      members: [
        {
          userId: admin,
          name: 'Member 0',
          email: 'm0@a.co',
          roleId: SystemRoleId.ADMIN,
          role: 'admin',
        },
        {
          userId: owner,
          name: 'Olive',
          email: 'o@a.co',
          roleId: SystemRoleId.OWNER,
          role: 'owner',
        },
      ],
    });
  });

  it('previews the newest members only and counts all of them', async () => {
    const { tenantId, workspaceId, owner, added } = await seedWorkspace(
      WORKSPACE_VIEW_MEMBER_LIMIT + 2,
    );

    const view = await query.findDetailFor(tenantId, workspaceId, owner);

    expect(view?.memberCount).toBe(WORKSPACE_VIEW_MEMBER_LIMIT + 3);
    expect(view?.members.map((member) => member.userId)).toEqual(
      added.slice(-WORKSPACE_VIEW_MEMBER_LIMIT).reverse(),
    );
  });

  it('breaks ties on created_at by user id, newest first', async () => {
    const { tenantId, workspaceId, owner } = await seedWorkspace(2);
    await pool.query('UPDATE workspace_members SET created_at = now()');

    const view = await query.findDetailFor(tenantId, workspaceId, owner);

    const ids = view?.members.map((member) => member.userId) ?? [];
    expect(ids).toEqual([...ids].sort().reverse());
  });

  it('returns null for a non-member, an unknown workspace and a workspace of another tenant', async () => {
    const { tenantId, workspaceId, owner } = await seedWorkspace(0);
    const outsider = await insertUser(tenantId, 'x@a.co', 'Xena');
    const otherTenantId = await insertTenant();
    const stranger = await insertUser(otherTenantId, 's@b.co', 'Sam');

    expect(await query.findDetailFor(tenantId, workspaceId, outsider)).toBeNull();
    expect(await query.findDetailFor(tenantId, WorkspaceId.generate(), owner)).toBeNull();
    expect(await query.findDetailFor(otherTenantId, workspaceId, owner)).toBeNull();
    expect(await query.findDetailFor(otherTenantId, workspaceId, stranger)).toBeNull();
  });
});
