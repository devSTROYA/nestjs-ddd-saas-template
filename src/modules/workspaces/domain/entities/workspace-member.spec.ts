import { TenantId } from '@modules/tenants';
import { UserId } from '@modules/users';

import { LastWorkspaceOwnerRequiredError } from '../errors/domain.error.js';
import { WorkspaceMemberEventNames } from '../events/workspace-member.events.js';
import { SystemRoleId } from '../value-objects/system-workspace-role.js';
import { WorkspaceId } from '../value-objects/workspace-id.js';
import { WorkspaceMemberId } from '../value-objects/workspace-member-id.js';
import { WorkspaceRoleId } from '../value-objects/workspace-role-id.js';
import { WorkspaceMember } from './workspace-member.js';

const CREATED_AT = new Date('2026-01-01T00:00:00Z');
const NOW = new Date('2026-01-02T00:00:00Z');

const newMember = (roleId: WorkspaceRoleId): WorkspaceMember =>
  WorkspaceMember.create({
    tenantId: TenantId.generate(),
    workspaceId: WorkspaceId.generate(),
    userId: UserId.generate(),
    roleId,
    createdAt: CREATED_AT,
  });

describe('WorkspaceMember', () => {
  it('starts with the given role and raises one event', () => {
    const member = newMember(SystemRoleId.ADMIN);

    expect(member.roleId).toEqual(SystemRoleId.ADMIN);
    expect(member.isOwner).toBe(false);
    expect(member.updatedAt).toEqual(CREATED_AT);
    expect(member.pullEvents()).toMatchObject([
      {
        name: WorkspaceMemberEventNames.ADDED,
        aggregateId: member.id,
        tenantId: member.tenantId,
        workspaceId: member.workspaceId,
        userId: member.userId,
        roleId: SystemRoleId.ADMIN,
        occurredAt: CREATED_AT.toISOString(),
      },
    ]);
    expect(member.pullEvents()).toEqual([]);
  });

  it('raises no event on rehydrate', () => {
    const restored = WorkspaceMember.rehydrate(
      {
        tenantId: TenantId.generate(),
        workspaceId: WorkspaceId.generate(),
        userId: UserId.generate(),
        roleId: SystemRoleId.OWNER,
        createdAt: CREATED_AT,
        updatedAt: NOW,
      },
      WorkspaceMemberId.generate(),
    );

    expect(restored.isOwner).toBe(true);
    expect(restored.pullEvents()).toEqual([]);
  });

  it('knows the owner role by id, even from a restored id', () => {
    expect(newMember(WorkspaceRoleId.parse(SystemRoleId.OWNER)).isOwner).toBe(true);
  });

  it('changes the role, moves updatedAt and raises an event', () => {
    const member = newMember(SystemRoleId.ADMIN);
    member.pullEvents();

    expect(member.changeRole(SystemRoleId.OWNER, 1, NOW)).toBe(true);

    expect(member.roleId).toEqual(SystemRoleId.OWNER);
    expect(member.updatedAt).toEqual(NOW);
    expect(member.createdAt).toEqual(CREATED_AT);
    expect(member.pullEvents()).toMatchObject([
      {
        name: WorkspaceMemberEventNames.ROLE_CHANGED,
        aggregateId: member.id,
        workspaceId: member.workspaceId,
        userId: member.userId,
        previousRoleId: SystemRoleId.ADMIN,
        roleId: SystemRoleId.OWNER,
      },
    ]);
  });

  it('changes nothing when the member already holds the role, even as the last owner', () => {
    const member = newMember(SystemRoleId.OWNER);
    member.pullEvents();

    expect(member.changeRole(SystemRoleId.OWNER, 1, NOW)).toBe(false);

    expect(member.roleId).toEqual(SystemRoleId.OWNER);
    expect(member.updatedAt).toEqual(CREATED_AT);
    expect(member.pullEvents()).toEqual([]);
  });

  it('keeps at least one owner when demoting, also to a custom role', () => {
    const member = newMember(SystemRoleId.OWNER);
    member.pullEvents();

    expect(() => member.changeRole(SystemRoleId.ADMIN, 1, NOW)).toThrow(
      LastWorkspaceOwnerRequiredError,
    );
    expect(() => member.changeRole(WorkspaceRoleId.generate(), 1, NOW)).toThrow(
      LastWorkspaceOwnerRequiredError,
    );
    expect(member.roleId).toEqual(SystemRoleId.OWNER);
    expect(member.pullEvents()).toEqual([]);

    member.changeRole(SystemRoleId.ADMIN, 2, NOW);
    expect(member.roleId).toEqual(SystemRoleId.ADMIN);
  });

  it('keeps at least one owner when removing', () => {
    const owner = newMember(SystemRoleId.OWNER);
    owner.pullEvents();

    expect(() => owner.remove(1, NOW)).toThrow(LastWorkspaceOwnerRequiredError);
    expect(owner.pullEvents()).toEqual([]);

    owner.remove(2, NOW);
    expect(owner.pullEvents()).toMatchObject([
      {
        name: WorkspaceMemberEventNames.REMOVED,
        aggregateId: owner.id,
        workspaceId: owner.workspaceId,
        userId: owner.userId,
        occurredAt: NOW.toISOString(),
      },
    ]);
  });

  it('lets an admin go whatever the owner count', () => {
    expect(() => newMember(SystemRoleId.ADMIN).remove(1, NOW)).not.toThrow();
  });
});
