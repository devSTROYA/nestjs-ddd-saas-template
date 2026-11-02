import { TenantId } from '@modules/tenants';
import { UserId } from '@modules/users';

import { LastWorkspaceOwnerRequiredError } from '../errors/domain.error.js';
import { WorkspaceMemberEventNames } from '../events/workspace-member.events.js';
import { WorkspaceId } from '../value-objects/workspace-id.js';
import { WorkspaceMemberId } from '../value-objects/workspace-member-id.js';
import { WorkspaceRole } from '../value-objects/workspace-role.js';
import { WorkspaceMember } from './workspace-member.js';

const CREATED_AT = new Date('2026-01-01T00:00:00Z');
const NOW = new Date('2026-01-02T00:00:00Z');

const newMember = (role: WorkspaceRole): WorkspaceMember =>
  WorkspaceMember.create({
    tenantId: TenantId.create(),
    workspaceId: WorkspaceId.create(),
    userId: UserId.create(),
    role,
    createdAt: CREATED_AT,
  });

describe('WorkspaceMember', () => {
  it('starts with the given role and raises one event', () => {
    const member = newMember(WorkspaceRole.ADMIN);

    expect(member.role).toBe(WorkspaceRole.ADMIN);
    expect(member.isOwner).toBe(false);
    expect(member.updatedAt).toEqual(CREATED_AT);
    expect(member.pullEvents()).toMatchObject([
      {
        name: WorkspaceMemberEventNames.ADDED,
        aggregateId: member.id.value,
        tenantId: member.tenantId.value,
        workspaceId: member.workspaceId.value,
        userId: member.userId.value,
        role: WorkspaceRole.ADMIN,
        occurredAt: CREATED_AT.toISOString(),
      },
    ]);
    expect(member.pullEvents()).toEqual([]);
  });

  it('raises no event on restore', () => {
    const restored = WorkspaceMember.restore(
      {
        tenantId: TenantId.create(),
        workspaceId: WorkspaceId.create(),
        userId: UserId.create(),
        role: WorkspaceRole.OWNER,
        createdAt: CREATED_AT,
        updatedAt: NOW,
      },
      WorkspaceMemberId.create(),
    );

    expect(restored.isOwner).toBe(true);
    expect(restored.pullEvents()).toEqual([]);
  });

  it('changes the role, moves updatedAt and raises an event', () => {
    const member = newMember(WorkspaceRole.ADMIN);
    member.pullEvents();

    member.changeRole(WorkspaceRole.OWNER, 1, NOW);

    expect(member.role).toBe(WorkspaceRole.OWNER);
    expect(member.updatedAt).toEqual(NOW);
    expect(member.createdAt).toEqual(CREATED_AT);
    expect(member.pullEvents()).toMatchObject([
      {
        name: WorkspaceMemberEventNames.ROLE_CHANGED,
        aggregateId: member.id.value,
        workspaceId: member.workspaceId.value,
        userId: member.userId.value,
        previousRole: WorkspaceRole.ADMIN,
        role: WorkspaceRole.OWNER,
      },
    ]);
  });

  it('keeps at least one owner when demoting', () => {
    const member = newMember(WorkspaceRole.OWNER);
    member.pullEvents();

    expect(() => member.changeRole(WorkspaceRole.ADMIN, 1, NOW)).toThrow(
      LastWorkspaceOwnerRequiredError,
    );
    expect(member.role).toBe(WorkspaceRole.OWNER);
    expect(member.pullEvents()).toEqual([]);

    member.changeRole(WorkspaceRole.ADMIN, 2, NOW);
    expect(member.role).toBe(WorkspaceRole.ADMIN);
  });

  it('keeps at least one owner when removing', () => {
    const owner = newMember(WorkspaceRole.OWNER);
    owner.pullEvents();

    expect(() => owner.remove(1, NOW)).toThrow(LastWorkspaceOwnerRequiredError);
    expect(owner.pullEvents()).toEqual([]);

    owner.remove(2, NOW);
    expect(owner.pullEvents()).toMatchObject([
      {
        name: WorkspaceMemberEventNames.REMOVED,
        aggregateId: owner.id.value,
        workspaceId: owner.workspaceId.value,
        userId: owner.userId.value,
        occurredAt: NOW.toISOString(),
      },
    ]);
  });

  it('lets an admin go whatever the owner count', () => {
    const admin = newMember(WorkspaceRole.ADMIN);

    expect(() => admin.remove(1, NOW)).not.toThrow();
  });
});
