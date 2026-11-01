import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { inject } from 'vitest';

import { DatabaseContext } from '@common/database';
import { TenantId } from '@modules/tenants';
import { UserId } from '@modules/users';

import { Workspace } from '../../domain/entities/workspace.js';
import { WorkspaceIdConflictError } from '../../domain/errors/domain.error.js';
import { WorkspaceEventNames } from '../../domain/events/workspace.events.js';
import { WorkspaceId } from '../../domain/value-objects/workspace-id.js';
import { WorkspaceName } from '../../domain/value-objects/workspace-name.js';
import { WorkspaceRole } from '../../domain/value-objects/workspace-role.js';
import { DrizzleWorkspaceRepository } from './drizzle-workspace.repository.js';

const pool = new Pool({ connectionString: inject('databaseUrl') });
const context = new DatabaseContext(drizzle(pool));
const repository = new DrizzleWorkspaceRepository(context);

const insertTenant = async (): Promise<TenantId> => {
  const id = TenantId.create();
  await pool.query("INSERT INTO tenants (id, name) VALUES ($1, 'T')", [id.value]);
  return id;
};

const insertUser = async (tenantId: TenantId, email: string): Promise<UserId> => {
  const id = UserId.create();
  await pool.query("INSERT INTO users (id, tenant_id, email, name) VALUES ($1, $2, $3, 'U')", [
    id.value,
    tenantId.value,
    email,
  ]);
  return id;
};

const newWorkspace = (tenantId: TenantId, ownerId: UserId) =>
  Workspace.create({
    tenantId,
    name: WorkspaceName.create('Acme'),
    ownerId,
    createdAt: new Date(),
  });

beforeEach(async () => {
  await pool.query('TRUNCATE TABLE outbox, workspace_members, workspaces, users, tenants CASCADE');
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
    workspace.addMember(admin, WorkspaceRole.ADMIN, new Date());
    await repository.save(workspace);

    const found = await repository.findById(tenantId, workspace.id);

    expect(found?.id).toEqual(workspace.id);
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

  it('returns null for an unknown workspace and for a workspace of another tenant', async () => {
    const tenantId = await insertTenant();
    const workspace = newWorkspace(tenantId, await insertUser(tenantId, 'o@a.co'));
    await repository.save(workspace);

    expect(await repository.findById(tenantId, WorkspaceId.create())).toBeNull();
    expect(await repository.findById(TenantId.create(), workspace.id)).toBeNull();
    expect(await repository.findByIdForUpdate(TenantId.create(), workspace.id)).toBeNull();
  });

  it('persists role changes and removals so the stored members match the aggregate', async () => {
    const tenantId = await insertTenant();
    const owner = await insertUser(tenantId, 'o@a.co');
    const second = await insertUser(tenantId, 's@a.co');
    const third = await insertUser(tenantId, 't@a.co');
    const workspace = newWorkspace(tenantId, owner);
    workspace.addMember(second, WorkspaceRole.ADMIN, new Date());
    workspace.addMember(third, WorkspaceRole.ADMIN, new Date());
    await repository.save(workspace);

    workspace.changeRole(second, WorkspaceRole.OWNER, new Date());
    workspace.removeMember(third, new Date());
    await repository.save(workspace);

    const found = await repository.findById(tenantId, workspace.id);
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
    const hijack = Workspace.restore(
      {
        tenantId: otherTenantId,
        name: WorkspaceName.create('Hijack'),
        roles: new Map([[intruder.value, WorkspaceRole.OWNER]]),
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      },
      workspace.id,
    );

    await expect(repository.save(hijack)).rejects.toThrow(WorkspaceIdConflictError);

    const found = await repository.findById(tenantId, workspace.id);
    expect(found?.name.value).toBe('Acme');
    expect(found?.members).toEqual([{ userId: owner, role: WorkspaceRole.OWNER }]);
  });

  it('locks the workspace row inside a transaction', async () => {
    const tenantId = await insertTenant();
    const owner = await insertUser(tenantId, 'o@a.co');
    const workspace = newWorkspace(tenantId, owner);
    await repository.save(workspace);

    const found = await context.run(() => repository.findByIdForUpdate(tenantId, workspace.id));

    expect(found?.tenantId).toEqual(tenantId);
  });

  it('rolls back a save made inside a failed transaction', async () => {
    const tenantId = await insertTenant();
    const owner = await insertUser(tenantId, 'o@a.co');
    const workspace = newWorkspace(tenantId, owner);

    await expect(
      context.run(async () => {
        await repository.save(workspace);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(await repository.findById(tenantId, workspace.id)).toBeNull();
    const { rows } = await pool.query('SELECT 1 FROM outbox');
    expect(rows).toHaveLength(0);
  });

  it('writes the pending events to the outbox with the workspace', async () => {
    const tenantId = await insertTenant();
    const owner = await insertUser(tenantId, 'o@a.co');
    const workspace = newWorkspace(tenantId, owner);
    workspace.addMember(await insertUser(tenantId, 'a@a.co'), WorkspaceRole.ADMIN, new Date());
    await repository.save(workspace);

    const { rows } = await pool.query<{ name: string; aggregate_id: string; tenant_id: string }>(
      'SELECT name, aggregate_id, tenant_id FROM outbox',
    );
    expect(rows).toHaveLength(2);
    expect(rows).toEqual(
      expect.arrayContaining([
        {
          name: WorkspaceEventNames.CREATED,
          aggregate_id: workspace.id.value,
          tenant_id: tenantId.value,
        },
        {
          name: WorkspaceEventNames.MEMBER_ADDED,
          aggregate_id: workspace.id.value,
          tenant_id: tenantId.value,
        },
      ]),
    );
  });
});
