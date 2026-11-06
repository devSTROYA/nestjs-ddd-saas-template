import { TenantId } from '@modules/tenants';

import { systemRoles } from '../../testing/system-roles.js';
import {
  SystemWorkspaceRoleError,
  WorkspaceOwnerRequiredError,
  WorkspacePermissionDeniedError,
  WorkspaceRoleKeyInvalidError,
  WorkspaceRoleKeyTakenError,
  WorkspaceRoleNameInvalidError,
} from '../errors/domain.error.js';
import { WorkspaceRoleEventNames } from '../events/workspace-role.events.js';
import { WorkspaceId } from '../value-objects/workspace-id.js';
import {
  ALL_WORKSPACE_PERMISSIONS,
  WorkspacePermission,
} from '../value-objects/workspace-permission.js';
import { WorkspaceRoleId } from '../value-objects/workspace-role-id.js';
import { WorkspacePermissionList } from './workspace-permission-list.js';
import { WorkspaceRole } from './workspace-role.js';

const CREATED_AT = new Date('2026-01-01T00:00:00Z');
const NOW = new Date('2026-01-02T00:00:00Z');
const { MEMBER_ADD, MEMBER_REMOVE, ROLE_MANAGE } = WorkspacePermission;

const newRole = (
  key = 'reviewer',
  name = ' Reviewer ',
  permissions: readonly WorkspacePermission[] = [MEMBER_ADD],
) =>
  WorkspaceRole.create({
    tenantId: TenantId.generate(),
    workspaceId: WorkspaceId.generate(),
    key,
    name,
    permissions,
    createdAt: CREATED_AT,
  });

const restoredRole = () =>
  WorkspaceRole.rehydrate(
    {
      tenantId: TenantId.generate(),
      workspaceId: WorkspaceId.generate(),
      key: 'reviewer',
      name: 'Reviewer',
      permissions: new WorkspacePermissionList([MEMBER_ADD, MEMBER_REMOVE]),
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    },
    WorkspaceRoleId.generate(),
  );

const systemRole = (key: string): WorkspaceRole => {
  const role = systemRoles().find((candidate) => candidate.key === key);
  if (!role) {
    throw new Error(`no system role ${key}`);
  }
  return role;
};

describe('WorkspaceRole', () => {
  it('trims the name, drops duplicate permissions and raises one event', () => {
    const role = newRole('reviewer', ' Reviewer ', [MEMBER_ADD, MEMBER_ADD]);

    expect(role.name).toBe('Reviewer');
    expect(role.isSystem).toBe(false);
    expect(role.permissions).toEqual([MEMBER_ADD]);
    expect(role.pullEvents()).toMatchObject([
      {
        name: WorkspaceRoleEventNames.CREATED,
        aggregateId: role.id,
        workspaceId: role.workspaceId,
        key: 'reviewer',
        permissions: [MEMBER_ADD],
      },
    ]);
  });

  it('reports every permission of a new role as added, so they get written', () => {
    expect(newRole().permissionChanges).toEqual({ added: [MEMBER_ADD], removed: [] });
  });

  it('refuses a malformed key, a system key and a bad name', () => {
    expect(() => newRole('Not Valid')).toThrow(WorkspaceRoleKeyInvalidError);
    expect(() => newRole('1abc')).toThrow(WorkspaceRoleKeyInvalidError);
    expect(() => newRole('a'.repeat(33))).toThrow(WorkspaceRoleKeyInvalidError);
    expect(() => newRole('admin')).toThrow(WorkspaceRoleKeyTakenError);
    expect(() => newRole('reviewer', '   ')).toThrow(WorkspaceRoleNameInvalidError);
    expect(() => newRole('reviewer', 'x'.repeat(65))).toThrow(WorkspaceRoleNameInvalidError);
  });

  it('tracks only what an update changes', () => {
    const role = restoredRole();

    role.update('Lead', [MEMBER_ADD, ROLE_MANAGE], NOW);

    expect(role.name).toBe('Lead');
    expect(role.updatedAt).toEqual(NOW);
    expect(role.permissions).toEqual([MEMBER_ADD, ROLE_MANAGE]);
    expect(role.permissionChanges).toEqual({ added: [ROLE_MANAGE], removed: [MEMBER_REMOVE] });
    expect(role.pullEvents()).toMatchObject([
      { name: WorkspaceRoleEventNames.UPDATED, permissions: [MEMBER_ADD, ROLE_MANAGE] },
    ]);
  });

  it('changes nothing when an update has a bad name', () => {
    const role = restoredRole();

    expect(() => role.update(' ', [], NOW)).toThrow(WorkspaceRoleNameInvalidError);

    expect(role.permissions).toEqual([MEMBER_ADD, MEMBER_REMOVE]);
    expect(role.pullEvents()).toEqual([]);
  });

  it('raises an event on remove and none on rehydrate', () => {
    const role = restoredRole();
    expect(role.pullEvents()).toEqual([]);

    role.remove(NOW);

    expect(role.pullEvents()).toMatchObject([
      { name: WorkspaceRoleEventNames.DELETED, key: 'reviewer' },
    ]);
  });

  it('never changes a system role', () => {
    const role = systemRole('admin');

    expect(role.isSystem).toBe(true);
    expect(() => role.update('Boss', [ROLE_MANAGE], NOW)).toThrow(SystemWorkspaceRoleError);
    expect(() => role.remove(NOW)).toThrow(SystemWorkspaceRoleError);
    expect(role.name).toBe('Admin');
    expect(role.permissions).not.toContain(ROLE_MANAGE);
    expect(role.pullEvents()).toEqual([]);
  });

  it('passes a held permission and names a missing one', () => {
    const role = newRole();

    expect(() => role.require(MEMBER_ADD)).not.toThrow();
    expect(() => role.require(ROLE_MANAGE)).toThrow(
      expect.objectContaining({ details: { missing: [ROLE_MANAGE] } }),
    );
  });

  it('manages a role with no more permissions than it holds', () => {
    expect(() => newRole().assertCanManage(newRole('peer'))).not.toThrow();
    expect(() => systemRole('owner').assertCanManage(newRole())).not.toThrow();
  });

  it('refuses a role that holds more, naming what is missing', () => {
    const wider = newRole('wider', 'Wider', [MEMBER_ADD, ROLE_MANAGE]);

    expect(() => newRole().assertCanManage(wider)).toThrow(WorkspacePermissionDeniedError);
    expect(() => newRole().assertCanManage(wider)).toThrow(
      expect.objectContaining({ details: { missing: [ROLE_MANAGE] } }),
    );
  });

  it('keeps owners to owners, even for a custom role with every permission', () => {
    const everything = newRole('everything', 'Everything', ALL_WORKSPACE_PERMISSIONS);
    const owner = systemRole('owner');

    expect(() => everything.assertCanManage(owner)).toThrow(WorkspaceOwnerRequiredError);
    expect(() => owner.assertCanManage(owner)).not.toThrow();
  });
});
