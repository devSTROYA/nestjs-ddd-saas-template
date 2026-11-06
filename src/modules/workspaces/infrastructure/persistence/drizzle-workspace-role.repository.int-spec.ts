import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { inject } from 'vitest';

import { DatabaseContext } from '@common/database';
import { TenantId } from '@modules/tenants';
import { UserId } from '@modules/users';

import { WorkspacePermissionList } from '../../domain/entities/workspace-permission-list.js';
import { WorkspaceRole } from '../../domain/entities/workspace-role.js';
import { Workspace } from '../../domain/entities/workspace.js';
import {
  WorkspaceRoleIdConflictError,
  WorkspaceRoleKeyTakenError,
} from '../../domain/errors/domain.error.js';
import { WorkspaceRoleEventNames } from '../../domain/events/workspace-role.events.js';
import { SystemRoleId } from '../../domain/value-objects/system-workspace-role.js';
import type { WorkspaceId } from '../../domain/value-objects/workspace-id.js';
import { WorkspaceName } from '../../domain/value-objects/workspace-name.js';
import { WorkspacePermission } from '../../domain/value-objects/workspace-permission.js';
import { WorkspaceRoleId } from '../../domain/value-objects/workspace-role-id.js';
import { restoreSystemRoles } from '../../testing/system-roles.js';
import { DrizzleWorkspaceRoleQuery } from './drizzle-workspace-role.query.js';
import { DrizzleWorkspaceRoleRepository } from './drizzle-workspace-role.repository.js';
import { DrizzleWorkspaceRepository } from './drizzle-workspace.repository.js';

const { MEMBER_ADD, MEMBER_REMOVE, ROLE_MANAGE } = WorkspacePermission;

const pool = new Pool({ connectionString: inject('databaseUrl') });
const context = new DatabaseContext(drizzle(pool));
const workspaces = new DrizzleWorkspaceRepository(context);
const repository = new DrizzleWorkspaceRoleRepository(context);
const query = new DrizzleWorkspaceRoleQuery(context);

const seedWorkspace = async (): Promise<{ tenantId: TenantId; workspaceId: WorkspaceId }> => {
  const tenantId = TenantId.generate();
  await pool.query("INSERT INTO tenants (id, name) VALUES ($1, 'T')", [tenantId]);
  const workspace = Workspace.create({
    tenantId,
    name: WorkspaceName.create('Acme'),
    ownerId: UserId.generate(),
    createdAt: new Date(),
  });
  await workspaces.save(workspace);
  return { tenantId, workspaceId: workspace.id };
};

const newRole = (
  tenantId: TenantId,
  workspaceId: WorkspaceId,
  permissions: readonly WorkspacePermission[] = [MEMBER_ADD, MEMBER_REMOVE],
  key = 'reviewer',
): WorkspaceRole =>
  WorkspaceRole.create({
    tenantId,
    workspaceId,
    key,
    name: 'Reviewer',
    permissions,
    createdAt: new Date(),
  });

const storedPermissions = async (id: WorkspaceRoleId): Promise<string[]> => {
  const { rows } = await pool.query<{ permission: string }>(
    'SELECT permission FROM workspace_role_permissions WHERE role_id = $1 ORDER BY permission',
    [id],
  );
  return rows.map((row) => row.permission);
};

beforeEach(async () => {
  await pool.query('TRUNCATE TABLE outbox, workspace_members, workspaces, users, tenants CASCADE');
  await restoreSystemRoles(pool);
});

afterAll(async () => {
  await pool.end();
});

describe('DrizzleWorkspaceRoleRepository', () => {
  it('saves a role with its permissions and reads it back by id', async () => {
    const { tenantId, workspaceId } = await seedWorkspace();
    const role = newRole(tenantId, workspaceId);
    await repository.save(role);

    const found = await repository.findById(tenantId, workspaceId, role.id);

    expect(found?.id).toEqual(role.id);
    expect(found?.name).toBe('Reviewer');
    expect(found?.isSystem).toBe(false);
    expect([...(found?.permissions ?? [])].sort()).toEqual([MEMBER_ADD, MEMBER_REMOVE].sort());
    expect(found?.permissionChanges).toEqual({ added: [], removed: [] });
  });

  it('finds a system role from any workspace', async () => {
    const { tenantId, workspaceId } = await seedWorkspace();
    const other = await seedWorkspace();

    const first = await repository.findById(tenantId, workspaceId, SystemRoleId.ADMIN);
    const second = await repository.findById(other.tenantId, other.workspaceId, SystemRoleId.ADMIN);

    expect(first?.isSystem).toBe(true);
    expect(first?.tenantId).toBeNull();
    expect(first?.key).toBe('admin');
    expect(second?.id).toEqual(SystemRoleId.ADMIN);
  });

  it('never finds a custom role through another tenant or workspace', async () => {
    const { tenantId, workspaceId } = await seedWorkspace();
    const other = await seedWorkspace();
    const role = newRole(tenantId, workspaceId);
    await repository.save(role);

    expect(await repository.findById(other.tenantId, workspaceId, role.id)).toBeNull();
    expect(await repository.findById(tenantId, other.workspaceId, role.id)).toBeNull();
    expect(await repository.findById(tenantId, workspaceId, WorkspaceRoleId.generate())).toBeNull();
  });

  it('writes only the permission changes of a loaded role', async () => {
    const { tenantId, workspaceId } = await seedWorkspace();
    const role = newRole(tenantId, workspaceId);
    await repository.save(role);
    const found = await repository.findById(tenantId, workspaceId, role.id);
    if (!found) {
      throw new Error('role not saved');
    }

    found.update('Lead', [MEMBER_ADD, ROLE_MANAGE], new Date());
    await repository.save(found);

    expect(await storedPermissions(role.id)).toEqual([MEMBER_ADD, ROLE_MANAGE].sort());
    const reloaded = await repository.findById(tenantId, workspaceId, role.id);
    expect(reloaded?.name).toBe('Lead');
  });

  it('can save the same instance twice', async () => {
    const { tenantId, workspaceId } = await seedWorkspace();
    const role = newRole(tenantId, workspaceId, [MEMBER_ADD]);
    await repository.save(role);

    await repository.save(role);

    expect(await storedPermissions(role.id)).toEqual([MEMBER_ADD]);
  });

  it('answers a taken key in the same workspace, and allows it in another', async () => {
    const { tenantId, workspaceId } = await seedWorkspace();
    const other = await seedWorkspace();
    await repository.save(newRole(tenantId, workspaceId));

    await expect(repository.save(newRole(tenantId, workspaceId))).rejects.toThrow(
      WorkspaceRoleKeyTakenError,
    );
    await expect(
      repository.save(newRole(other.tenantId, other.workspaceId)),
    ).resolves.toBeUndefined();
  });

  it('refuses to overwrite a role of another tenant, permissions included', async () => {
    const { tenantId, workspaceId } = await seedWorkspace();
    const role = newRole(tenantId, workspaceId, [MEMBER_ADD]);
    await repository.save(role);
    const other = await seedWorkspace();
    const permissions = new WorkspacePermissionList();
    permissions.update([ROLE_MANAGE]);
    const hijack = WorkspaceRole.rehydrate(
      {
        tenantId: other.tenantId,
        workspaceId: other.workspaceId,
        key: 'hijack',
        name: 'Hijack',
        permissions,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
      },
      role.id,
    );

    await expect(repository.save(hijack)).rejects.toThrow(WorkspaceRoleIdConflictError);

    expect(await storedPermissions(role.id)).toEqual([MEMBER_ADD]);
  });

  it('can never write over a system role, even when handed one directly', async () => {
    const { tenantId, workspaceId } = await seedWorkspace();
    const permissions = new WorkspacePermissionList();
    permissions.update([ROLE_MANAGE]);
    const forged = WorkspaceRole.rehydrate(
      {
        tenantId,
        workspaceId,
        key: 'forged',
        name: 'Forged',
        permissions,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      SystemRoleId.ADMIN,
    );

    await expect(repository.save(forged)).rejects.toThrow(WorkspaceRoleIdConflictError);
    await repository.delete(forged);

    const admin = await repository.findById(tenantId, workspaceId, SystemRoleId.ADMIN);
    expect(admin?.name).toBe('Admin');
    expect(admin?.permissions).not.toContain(ROLE_MANAGE);
  });

  it('refuses a second system role with the same key', async () => {
    await expect(
      pool.query("INSERT INTO workspace_roles (id, key, name) VALUES ($1, 'admin', 'Copy')", [
        WorkspaceRoleId.generate(),
      ]),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('refuses a role with a tenant but no workspace', async () => {
    const { tenantId } = await seedWorkspace();

    await expect(
      pool.query(
        "INSERT INTO workspace_roles (id, tenant_id, key, name) VALUES ($1, $2, 'half', 'Half')",
        [WorkspaceRoleId.generate(), tenantId],
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('deletes a role with its permissions and queues the event', async () => {
    const { tenantId, workspaceId } = await seedWorkspace();
    const role = newRole(tenantId, workspaceId);
    await repository.save(role);

    role.remove(new Date());
    await repository.delete(role);

    expect(await repository.findById(tenantId, workspaceId, role.id)).toBeNull();
    expect(await storedPermissions(role.id)).toEqual([]);
    const { rows } = await pool.query<{ aggregate_id: string }>(
      'SELECT aggregate_id FROM outbox WHERE name = $1',
      [WorkspaceRoleEventNames.DELETED],
    );
    expect(rows).toEqual([{ aggregate_id: role.id }]);
  });

  it('ignores a stored permission this version does not know', async () => {
    const { tenantId, workspaceId } = await seedWorkspace();
    const role = newRole(tenantId, workspaceId, [MEMBER_ADD]);
    await repository.save(role);
    await pool.query(
      "INSERT INTO workspace_role_permissions (role_id, permission) VALUES ($1, 'legacy:thing')",
      [role.id],
    );

    const found = await repository.findById(tenantId, workspaceId, role.id);

    expect(found?.permissions).toEqual([MEMBER_ADD]);
  });
});

describe('DrizzleWorkspaceRoleQuery', () => {
  const seedMember = async (): Promise<{
    tenantId: TenantId;
    workspaceId: WorkspaceId;
    actor: UserId;
  }> => {
    const { tenantId, workspaceId } = await seedWorkspace();
    const actor = UserId.generate();
    await pool.query("INSERT INTO users (id, tenant_id, email, name) VALUES ($1, $2, $3, 'U')", [
      actor,
      tenantId,
      `${actor}@a.co`,
    ]);
    await pool.query(
      'INSERT INTO workspace_members (id, tenant_id, workspace_id, user_id, role_id) VALUES ($1, $2, $3, $4, $5)',
      [WorkspaceRoleId.generate(), tenantId, workspaceId, actor, SystemRoleId.MEMBER],
    );
    return { tenantId, workspaceId, actor };
  };

  it('lists system roles first, then only the custom roles of this workspace', async () => {
    const { tenantId, workspaceId, actor } = await seedMember();
    const other = await seedWorkspace();
    const role = newRole(tenantId, workspaceId, [MEMBER_ADD]);
    await repository.save(role);
    await repository.save(newRole(other.tenantId, other.workspaceId, [], 'elsewhere'));

    const roles = await query.listFor(tenantId, workspaceId, actor);

    expect(roles?.map(({ key, system }) => ({ key, system }))).toEqual([
      { key: 'admin', system: true },
      { key: 'member', system: true },
      { key: 'owner', system: true },
      { key: 'reviewer', system: false },
    ]);
    expect(roles?.[3]).toEqual({
      id: role.id,
      key: 'reviewer',
      name: 'Reviewer',
      system: false,
      permissions: [MEMBER_ADD],
    });
  });

  it('returns null for a non-member and for a workspace of another tenant', async () => {
    const { tenantId, workspaceId, actor } = await seedMember();
    const other = await seedWorkspace();

    expect(await query.listFor(tenantId, workspaceId, UserId.generate())).toBeNull();
    expect(await query.listFor(other.tenantId, workspaceId, actor)).toBeNull();
  });
});
