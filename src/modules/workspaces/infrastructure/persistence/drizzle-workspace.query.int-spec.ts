import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { inject } from 'vitest';

import { DatabaseContext } from '@common/database';
import { type TenantId, newTenantId } from '@modules/tenants';
import { type UserId, newUserId } from '@modules/users';

import { Workspace } from '../../domain/entities/workspace.js';
import { WORKSPACE_VIEW_MEMBER_LIMIT } from '../../application/ports/workspace.query.js';
import { type WorkspaceId, newWorkspaceId } from '../../domain/value-objects/workspace-id.js';
import { WorkspaceName } from '../../domain/value-objects/workspace-name.js';
import { WorkspaceRole } from '../../domain/value-objects/workspace-role.js';
import { DrizzleWorkspaceQuery } from './drizzle-workspace.query.js';
import { DrizzleWorkspaceRepository } from './drizzle-workspace.repository.js';

const pool = new Pool({ connectionString: inject('databaseUrl') });
const context = new DatabaseContext(drizzle(pool));
const repository = new DrizzleWorkspaceRepository(context);
const query = new DrizzleWorkspaceQuery(context);

const insertTenant = async (): Promise<TenantId> => {
  const id = newTenantId();
  await pool.query("INSERT INTO tenants (id, name) VALUES ($1, 'T')", [id]);
  return id;
};

const insertUser = async (tenantId: TenantId, email: string, name: string): Promise<UserId> => {
  const id = newUserId();
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
  const workspace = Workspace.create(
    { tenantId, name: WorkspaceName.create('Acme'), ownerId: owner },
    newWorkspaceId(),
  );
  await repository.save(workspace);
  const start = Date.now();
  await pool.query('UPDATE workspace_members SET created_at = $1', [new Date(start)]);
  const added: UserId[] = [];
  for (let index = 0; index < extraMembers; index++) {
    const userId = await insertUser(tenantId, `m${index}@a.co`, `Member ${index}`);
    await pool.query(
      "INSERT INTO workspace_members (workspace_id, user_id, role, created_at) VALUES ($1, $2, 'admin', $3)",
      [workspace.id, userId, new Date(start + (index + 1) * 60_000)],
    );
    added.push(userId);
  }
  return { tenantId, workspaceId: workspace.id, owner, added };
};

describe('DrizzleWorkspaceQuery', () => {
  describe('findViewFor', () => {
    it('returns the workspace with its members, their name and email, and the role of the actor', async () => {
      const { tenantId, workspaceId, owner, added } = await seedWorkspace(1);
      const [admin] = added;

      const view = await query.findViewFor(tenantId, workspaceId, admin as UserId);

      expect(view).toEqual({
        id: workspaceId,
        name: 'Acme',
        role: WorkspaceRole.ADMIN,
        memberCount: 2,
        members: [
          { userId: admin, name: 'Member 0', email: 'm0@a.co', role: WorkspaceRole.ADMIN },
          { userId: owner, name: 'Olive', email: 'o@a.co', role: WorkspaceRole.OWNER },
        ],
      });
    });

    it('previews the newest members only and counts all of them', async () => {
      const { tenantId, workspaceId, owner, added } = await seedWorkspace(
        WORKSPACE_VIEW_MEMBER_LIMIT + 2,
      );

      const view = await query.findViewFor(tenantId, workspaceId, owner);

      expect(view?.memberCount).toBe(WORKSPACE_VIEW_MEMBER_LIMIT + 3);
      expect(view?.members.map((member) => member.userId)).toEqual(
        added.slice(-WORKSPACE_VIEW_MEMBER_LIMIT).reverse(),
      );
    });

    it('breaks ties on created_at by user id, newest first', async () => {
      const { tenantId, workspaceId, owner } = await seedWorkspace(2);
      await pool.query('UPDATE workspace_members SET created_at = now()');

      const view = await query.findViewFor(tenantId, workspaceId, owner);

      const ids = view?.members.map((member) => member.userId) ?? [];
      expect(ids).toEqual([...ids].sort().reverse());
    });

    it('returns null for a non-member, an unknown workspace and a workspace of another tenant', async () => {
      const { tenantId, workspaceId, owner } = await seedWorkspace(0);
      const outsider = await insertUser(tenantId, 'x@a.co', 'Xena');
      const otherTenantId = await insertTenant();
      const stranger = await insertUser(otherTenantId, 's@b.co', 'Sam');

      expect(await query.findViewFor(tenantId, workspaceId, outsider)).toBeNull();
      expect(await query.findViewFor(tenantId, newWorkspaceId(), owner)).toBeNull();
      expect(await query.findViewFor(otherTenantId, workspaceId, owner)).toBeNull();
      expect(await query.findViewFor(otherTenantId, workspaceId, stranger)).toBeNull();
    });
  });

  describe('listMembers', () => {
    it('pages the members newest first with the total', async () => {
      const { tenantId, workspaceId, owner, added } = await seedWorkspace(4);
      const newestFirst = [...added.reverse(), owner];
      const page = (number: number) =>
        query.listMembers({ tenantId, workspaceId, actorId: owner, page: number, limit: 2 });

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
        role: WorkspaceRole.ADMIN,
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
        query.listMembers({ ...params, page: 1, limit: 20 });

      expect(await list({ tenantId, workspaceId, actorId: outsider })).toBeNull();
      expect(await list({ tenantId, workspaceId: newWorkspaceId(), actorId: owner })).toBeNull();
      expect(await list({ tenantId: otherTenantId, workspaceId, actorId: owner })).toBeNull();
    });
  });
});
