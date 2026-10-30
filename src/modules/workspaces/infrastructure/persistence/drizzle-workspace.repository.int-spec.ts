import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { inject } from 'vitest';

import { DatabaseContext } from '@common/database';
import { type TenantId, newTenantId } from '@modules/tenants';
import { type UserId, newUserId } from '@modules/users';

import { Workspace } from '../../domain/entities/workspace.js';
import { WorkspaceIdConflictError } from '../../domain/errors/domain.error.js';
import { newWorkspaceId } from '../../domain/value-objects/workspace-id.js';
import { WorkspaceName } from '../../domain/value-objects/workspace-name.js';
import { WorkspaceRole } from '../../domain/value-objects/workspace-role.js';
import { DrizzleWorkspaceRepository } from './drizzle-workspace.repository.js';

const pool = new Pool({ connectionString: inject('databaseUrl') });
const context = new DatabaseContext(drizzle(pool));
const repository = new DrizzleWorkspaceRepository(context);

const insertTenant = async (): Promise<TenantId> => {
  const id = newTenantId();
  await pool.query("INSERT INTO tenants (id, name) VALUES ($1, 'T')", [id]);
  return id;
};

const insertUser = async (tenantId: TenantId, email: string): Promise<UserId> => {
  const id = newUserId();
  await pool.query("INSERT INTO users (id, tenant_id, email, name) VALUES ($1, $2, $3, 'U')", [
    id,
    tenantId,
    email,
  ]);
  return id;
};

const newWorkspace = (tenantId: TenantId, ownerId: UserId) =>
  Workspace.create({
    id: newWorkspaceId(),
    tenantId,
    name: WorkspaceName.create('Acme'),
    ownerId,
  });

beforeEach(async () => {
  await pool.query('TRUNCATE TABLE workspace_members, workspaces, users, tenants CASCADE');
});

afterAll(async () => {
  await pool.end();
});

describe('DrizzleWorkspaceRepository', () => {
  it('saves a workspace with its members and reads it back by tenant', async () => {
    const tenantId = await insertTenant();
    const owner = await insertUser(tenantId, 'o@a.co');
    const admin = await insertUser(tenantId, 'a@a.co');
    const workspace = newWorkspace(tenantId, owner);
    workspace.addMember(admin, WorkspaceRole.ADMIN);
    await repository.save(workspace);

    const found = await repository.findByTenantId(tenantId);

    expect(found?.id).toBe(workspace.id);
    expect(found?.name.value).toBe('Acme');
    expect(found?.createdAt).toEqual(workspace.createdAt);
    expect(found?.members).toEqual(
      expect.arrayContaining([
        { userId: owner, role: WorkspaceRole.OWNER },
        { userId: admin, role: WorkspaceRole.ADMIN },
      ]),
    );
    expect(found?.members).toHaveLength(2);
  });

  it('returns null for a tenant without a workspace', async () => {
    expect(await repository.findByTenantId(newTenantId())).toBeNull();
  });

  it('persists role changes and removals so the stored members match the aggregate', async () => {
    const tenantId = await insertTenant();
    const owner = await insertUser(tenantId, 'o@a.co');
    const second = await insertUser(tenantId, 's@a.co');
    const third = await insertUser(tenantId, 't@a.co');
    const workspace = newWorkspace(tenantId, owner);
    workspace.addMember(second, WorkspaceRole.ADMIN);
    workspace.addMember(third, WorkspaceRole.ADMIN);
    await repository.save(workspace);

    workspace.changeRole(second, WorkspaceRole.OWNER);
    workspace.removeMember(third);
    await repository.save(workspace);

    const found = await repository.findByTenantId(tenantId);
    expect(found?.roleOf(second)).toBe(WorkspaceRole.OWNER);
    expect(found?.roleOf(third)).toBeNull();
    expect(found?.members).toHaveLength(2);
  });

  it('allows only one workspace per tenant', async () => {
    const tenantId = await insertTenant();
    const owner = await insertUser(tenantId, 'o@a.co');
    await repository.save(newWorkspace(tenantId, owner));

    await expect(repository.save(newWorkspace(tenantId, owner))).rejects.toMatchObject({
      cause: { code: '23505' },
    });
  });

  it('refuses to overwrite a workspace of another tenant, members included', async () => {
    const tenantId = await insertTenant();
    const owner = await insertUser(tenantId, 'o@a.co');
    const workspace = newWorkspace(tenantId, owner);
    await repository.save(workspace);
    const otherTenantId = await insertTenant();
    const intruder = await insertUser(otherTenantId, 'i@b.co');
    const hijack = Workspace.restore({
      id: workspace.id,
      tenantId: otherTenantId,
      name: WorkspaceName.create('Hijack'),
      members: [{ userId: intruder, role: WorkspaceRole.OWNER }],
      createdAt: workspace.createdAt,
    });

    await expect(repository.save(hijack)).rejects.toThrow(WorkspaceIdConflictError);

    const found = await repository.findByTenantId(tenantId);
    expect(found?.name.value).toBe('Acme');
    expect(found?.members).toEqual([{ userId: owner, role: WorkspaceRole.OWNER }]);
  });

  it('locks the workspace row inside a transaction', async () => {
    const tenantId = await insertTenant();
    const owner = await insertUser(tenantId, 'o@a.co');
    await repository.save(newWorkspace(tenantId, owner));

    const found = await context.run(() => repository.findByTenantIdForUpdate(tenantId));

    expect(found?.tenantId).toBe(tenantId);
  });

  it('rolls back a save made inside a failed transaction', async () => {
    const tenantId = await insertTenant();
    const owner = await insertUser(tenantId, 'o@a.co');

    await expect(
      context.run(async () => {
        await repository.save(newWorkspace(tenantId, owner));
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(await repository.findByTenantId(tenantId)).toBeNull();
  });
});
