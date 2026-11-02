import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { inject } from 'vitest';

import { DatabaseContext } from '@common/database';
import { TenantId } from '@modules/tenants';
import { UserId } from '@modules/users';

import { WorkspaceMember } from '../../domain/entities/workspace-member.js';
import { Workspace } from '../../domain/entities/workspace.js';
import {
  InvalidWorkspaceRoleError,
  WorkspaceMemberAlreadyExistsError,
  WorkspaceMemberIdConflictError,
} from '../../domain/errors/domain.error.js';
import { WorkspaceMemberEventNames } from '../../domain/events/workspace-member.events.js';
import { WorkspaceId } from '../../domain/value-objects/workspace-id.js';
import { WorkspaceName } from '../../domain/value-objects/workspace-name.js';
import { WorkspaceRole } from '../../domain/value-objects/workspace-role.js';
import { DrizzleWorkspaceMemberRepository } from './drizzle-workspace-member.repository.js';
import { DrizzleWorkspaceRepository } from './drizzle-workspace.repository.js';

const pool = new Pool({ connectionString: inject('databaseUrl') });
const context = new DatabaseContext(drizzle(pool));
const workspaces = new DrizzleWorkspaceRepository(context);
const repository = new DrizzleWorkspaceMemberRepository(context);

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

const seedWorkspace = async (): Promise<{ tenantId: TenantId; workspaceId: WorkspaceId }> => {
  const tenantId = await insertTenant();
  const workspace = Workspace.create({
    tenantId,
    name: WorkspaceName.create('Acme'),
    ownerId: UserId.create(),
    createdAt: new Date(),
  });
  await workspaces.save(workspace);
  return { tenantId, workspaceId: workspace.id };
};

const newMember = (
  tenantId: TenantId,
  workspaceId: WorkspaceId,
  userId: UserId,
  role: WorkspaceRole = WorkspaceRole.ADMIN,
): WorkspaceMember =>
  WorkspaceMember.create({ tenantId, workspaceId, userId, role, createdAt: new Date() });

beforeEach(async () => {
  await pool.query('TRUNCATE TABLE outbox, workspace_members, workspaces, users, tenants CASCADE');
});

afterAll(async () => {
  await pool.end();
});

describe('DrizzleWorkspaceMemberRepository', () => {
  it('saves a member and reads it back by user', async () => {
    const { tenantId, workspaceId } = await seedWorkspace();
    const userId = await insertUser(tenantId, 'a@a.co');
    const member = newMember(tenantId, workspaceId, userId);
    await repository.save(member);

    const found = await repository.findByUser(tenantId, workspaceId, userId);

    expect(found?.id).toEqual(member.id);
    expect(found?.tenantId).toEqual(tenantId);
    expect(found?.workspaceId).toEqual(workspaceId);
    expect(found?.userId).toEqual(userId);
    expect(found?.role).toBe(WorkspaceRole.ADMIN);
    expect(found?.createdAt).toEqual(member.createdAt);
  });

  it('never finds a member through another tenant or workspace', async () => {
    const { tenantId, workspaceId } = await seedWorkspace();
    const userId = await insertUser(tenantId, 'a@a.co');
    await repository.save(newMember(tenantId, workspaceId, userId));

    expect(await repository.findByUser(TenantId.create(), workspaceId, userId)).toBeNull();
    expect(await repository.findByUser(tenantId, WorkspaceId.create(), userId)).toBeNull();
    expect(await repository.findByUser(tenantId, workspaceId, UserId.create())).toBeNull();
  });

  it('persists a role change', async () => {
    const { tenantId, workspaceId } = await seedWorkspace();
    const userId = await insertUser(tenantId, 'a@a.co');
    const member = newMember(tenantId, workspaceId, userId);
    await repository.save(member);
    const changedAt = new Date(member.createdAt.getTime() + 60_000);

    member.changeRole(WorkspaceRole.OWNER, 1, changedAt);
    await repository.save(member);

    const found = await repository.findByUser(tenantId, workspaceId, userId);
    expect(found?.role).toBe(WorkspaceRole.OWNER);
    expect(found?.updatedAt).toEqual(changedAt);
    expect(found?.createdAt).toEqual(member.createdAt);
  });

  it('counts only the owners of the workspace of that tenant', async () => {
    const { tenantId, workspaceId } = await seedWorkspace();
    const other = await seedWorkspace();
    await repository.save(
      newMember(tenantId, workspaceId, await insertUser(tenantId, 'o@a.co'), WorkspaceRole.OWNER),
    );
    await repository.save(
      newMember(tenantId, workspaceId, await insertUser(tenantId, 'p@a.co'), WorkspaceRole.OWNER),
    );
    await repository.save(newMember(tenantId, workspaceId, await insertUser(tenantId, 'a@a.co')));
    await repository.save(
      newMember(
        other.tenantId,
        other.workspaceId,
        await insertUser(other.tenantId, 'o@b.co'),
        WorkspaceRole.OWNER,
      ),
    );

    expect(await repository.countOwners(tenantId, workspaceId)).toBe(2);
    expect(await repository.countOwners(other.tenantId, workspaceId)).toBe(0);
  });

  it('deletes a member and queues its removal event', async () => {
    const { tenantId, workspaceId } = await seedWorkspace();
    const userId = await insertUser(tenantId, 'a@a.co');
    const member = newMember(tenantId, workspaceId, userId);
    await repository.save(member);

    member.remove(1, new Date());
    await repository.delete(member);

    expect(await repository.findByUser(tenantId, workspaceId, userId)).toBeNull();
    const { rows } = await pool.query<{ name: string; aggregate_id: string; tenant_id: string }>(
      'SELECT name, aggregate_id, tenant_id FROM outbox WHERE name = $1',
      [WorkspaceMemberEventNames.REMOVED],
    );
    expect(rows).toEqual([
      {
        name: WorkspaceMemberEventNames.REMOVED,
        aggregate_id: member.id.value,
        tenant_id: tenantId.value,
      },
    ]);
  });

  it('answers a second membership of the same user as already existing', async () => {
    const { tenantId, workspaceId } = await seedWorkspace();
    const userId = await insertUser(tenantId, 'a@a.co');
    await repository.save(newMember(tenantId, workspaceId, userId));

    await expect(repository.save(newMember(tenantId, workspaceId, userId))).rejects.toThrow(
      WorkspaceMemberAlreadyExistsError,
    );
  });

  it('refuses to overwrite a member of another tenant', async () => {
    const { tenantId, workspaceId } = await seedWorkspace();
    const userId = await insertUser(tenantId, 'a@a.co');
    const member = newMember(tenantId, workspaceId, userId);
    await repository.save(member);
    const other = await seedWorkspace();
    const hijack = WorkspaceMember.restore(
      {
        tenantId: other.tenantId,
        workspaceId: other.workspaceId,
        userId: await insertUser(other.tenantId, 'i@b.co'),
        role: WorkspaceRole.OWNER,
        createdAt: member.createdAt,
        updatedAt: member.updatedAt,
      },
      member.id,
    );

    await expect(repository.save(hijack)).rejects.toThrow(WorkspaceMemberIdConflictError);

    const found = await repository.findByUser(tenantId, workspaceId, userId);
    expect(found?.role).toBe(WorkspaceRole.ADMIN);
  });

  it('does not delete a member of another tenant', async () => {
    const { tenantId, workspaceId } = await seedWorkspace();
    const userId = await insertUser(tenantId, 'a@a.co');
    const member = newMember(tenantId, workspaceId, userId);
    await repository.save(member);
    const other = await seedWorkspace();
    const hijack = WorkspaceMember.restore(
      {
        tenantId: other.tenantId,
        workspaceId: other.workspaceId,
        userId,
        role: WorkspaceRole.ADMIN,
        createdAt: member.createdAt,
        updatedAt: member.updatedAt,
      },
      member.id,
    );

    await repository.delete(hijack);

    expect(await repository.findByUser(tenantId, workspaceId, userId)).not.toBeNull();
  });

  it('rejects a stored role it does not know', async () => {
    const { tenantId, workspaceId } = await seedWorkspace();
    const userId = await insertUser(tenantId, 'a@a.co');
    await repository.save(newMember(tenantId, workspaceId, userId));
    await pool.query("UPDATE workspace_members SET role = 'ghost'");

    await expect(repository.findByUser(tenantId, workspaceId, userId)).rejects.toThrow(
      InvalidWorkspaceRoleError,
    );
  });

  it('writes the event to the outbox with the member as the aggregate', async () => {
    const { tenantId, workspaceId } = await seedWorkspace();
    const member = newMember(tenantId, workspaceId, await insertUser(tenantId, 'a@a.co'));
    await repository.save(member);

    const { rows } = await pool.query<{ aggregate_id: string; payload: { workspaceId: string } }>(
      'SELECT aggregate_id, payload FROM outbox WHERE name = $1',
      [WorkspaceMemberEventNames.ADDED],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.aggregate_id).toBe(member.id.value);
    expect(rows[0]?.payload.workspaceId).toBe(workspaceId.value);
  });
});
