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
import { DrizzleWorkspaceRepository } from './drizzle-workspace.repository.js';

const pool = new Pool({ connectionString: inject('databaseUrl') });
const context = new DatabaseContext(drizzle(pool));
const repository = new DrizzleWorkspaceRepository(context);

const insertTenant = async (): Promise<TenantId> => {
  const id = TenantId.generate();
  await pool.query("INSERT INTO tenants (id, name) VALUES ($1, 'T')", [id]);
  return id;
};

const newWorkspace = (tenantId: TenantId) =>
  Workspace.create({
    tenantId,
    name: WorkspaceName.create('Acme'),
    ownerId: UserId.generate(),
    createdAt: new Date(),
  });

beforeEach(async () => {
  await pool.query('TRUNCATE TABLE outbox, workspace_members, workspaces, users, tenants CASCADE');
});

afterAll(async () => {
  await pool.end();
});

describe('DrizzleWorkspaceRepository', () => {
  it('saves a workspace and reads it back by tenant', async () => {
    const tenantId = await insertTenant();
    const workspace = newWorkspace(tenantId);
    await repository.save(workspace);

    const found = await repository.findById(tenantId, workspace.id);

    expect(found?.id).toEqual(workspace.id);
    expect(found?.name.value).toBe('Acme');
    expect(found?.createdAt).toEqual(workspace.createdAt);
  });

  it('returns null for an unknown workspace and for a workspace of another tenant', async () => {
    const tenantId = await insertTenant();
    const workspace = newWorkspace(tenantId);
    await repository.save(workspace);

    expect(await repository.findById(tenantId, WorkspaceId.generate())).toBeNull();
    expect(await repository.findById(TenantId.generate(), workspace.id)).toBeNull();
    expect(await repository.findByIdForUpdate(TenantId.generate(), workspace.id)).toBeNull();
  });

  it('persists a rename', async () => {
    const tenantId = await insertTenant();
    const workspace = newWorkspace(tenantId);
    await repository.save(workspace);

    workspace.rename(WorkspaceName.create('Beta'), new Date());
    await repository.save(workspace);

    const found = await repository.findById(tenantId, workspace.id);
    expect(found?.name.value).toBe('Beta');
  });

  it('allows only one workspace per tenant', async () => {
    const tenantId = await insertTenant();
    await repository.save(newWorkspace(tenantId));

    await expect(repository.save(newWorkspace(tenantId))).rejects.toMatchObject({
      cause: { code: '23505' },
    });
  });

  it('refuses to overwrite a workspace of another tenant', async () => {
    const tenantId = await insertTenant();
    const workspace = newWorkspace(tenantId);
    await repository.save(workspace);
    const hijack = Workspace.rehydrate(
      {
        tenantId: await insertTenant(),
        name: WorkspaceName.create('Hijack'),
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      },
      workspace.id,
    );

    await expect(repository.save(hijack)).rejects.toThrow(WorkspaceIdConflictError);

    const found = await repository.findById(tenantId, workspace.id);
    expect(found?.name.value).toBe('Acme');
  });

  it('locks the workspace row inside a transaction', async () => {
    const tenantId = await insertTenant();
    const workspace = newWorkspace(tenantId);
    await repository.save(workspace);

    const found = await context.run(() => repository.findByIdForUpdate(tenantId, workspace.id));

    expect(found?.tenantId).toEqual(tenantId);
  });

  it('rolls back a save made inside a failed transaction', async () => {
    const tenantId = await insertTenant();
    const workspace = newWorkspace(tenantId);

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
    const workspace = newWorkspace(tenantId);
    await repository.save(workspace);

    const { rows } = await pool.query<{ name: string; aggregate_id: string; tenant_id: string }>(
      'SELECT name, aggregate_id, tenant_id FROM outbox',
    );
    expect(rows).toEqual([
      {
        name: WorkspaceEventNames.CREATED,
        aggregate_id: workspace.id,
        tenant_id: tenantId,
      },
    ]);
  });
});
