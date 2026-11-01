import { TenantId } from '@modules/tenants';
import { UserId } from '@modules/users';

import {
  LastWorkspaceOwnerRequiredError,
  WorkspaceMemberAlreadyExistsError,
  WorkspaceMemberNotFoundError,
  WorkspaceOwnerRequiredError,
} from '../errors/domain.error.js';
import { WorkspaceEventNames } from '../events/workspace.events.js';
import { WorkspaceId } from '../value-objects/workspace-id.js';
import { WorkspaceName } from '../value-objects/workspace-name.js';
import { WorkspaceRole } from '../value-objects/workspace-role.js';
import { Workspace } from './workspace.js';

const OWNER = UserId.create();
const CREATED_AT = new Date('2026-01-01T00:00:00Z');
const NOW = new Date('2026-01-02T00:00:00Z');
const LATER = new Date('2026-01-03T00:00:00Z');

const newWorkspace = (): Workspace =>
  Workspace.create({
    tenantId: TenantId.create(),
    name: WorkspaceName.create('Acme'),
    ownerId: OWNER,
    createdAt: CREATED_AT,
  });

describe('Workspace', () => {
  it('starts with its creator as the only owner', () => {
    expect(newWorkspace().members).toEqual([{ userId: OWNER, role: WorkspaceRole.OWNER }]);
  });

  it('restores its members without validation', () => {
    const member = { userId: UserId.create(), role: WorkspaceRole.ADMIN };
    const workspace = Workspace.restore(
      {
        tenantId: TenantId.create(),
        name: WorkspaceName.restore('Acme'),
        roles: new Map([[member.userId.value, member.role]]),
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-02T00:00:00Z'),
      },
      WorkspaceId.create(),
    );

    expect(workspace.members).toEqual([member]);
  });

  it('moves updatedAt forward on every mutation and leaves createdAt alone', () => {
    const workspace = newWorkspace();
    expect(workspace.createdAt).toEqual(CREATED_AT);
    expect(workspace.updatedAt).toEqual(CREATED_AT);

    workspace.rename(WorkspaceName.create('Renamed'), NOW);
    expect(workspace.updatedAt).toEqual(NOW);

    const member = UserId.create();
    workspace.addMember(member, WorkspaceRole.ADMIN, LATER);
    expect(workspace.updatedAt).toEqual(LATER);
    const evenLater = new Date('2026-01-04T00:00:00Z');
    workspace.changeRole(member, WorkspaceRole.OWNER, evenLater);
    expect(workspace.updatedAt).toEqual(evenLater);
    const last = new Date('2026-01-05T00:00:00Z');
    workspace.removeMember(member, last);
    expect(workspace.updatedAt).toEqual(last);
    expect(workspace.createdAt).toEqual(CREATED_AT);
  });

  it('adds a member with a role, once', () => {
    const workspace = newWorkspace();
    const user = UserId.create();

    workspace.addMember(user, WorkspaceRole.ADMIN, NOW);

    expect(workspace.roleOf(user)).toBe(WorkspaceRole.ADMIN);
    expect(() => workspace.addMember(user, WorkspaceRole.OWNER, NOW)).toThrow(
      WorkspaceMemberAlreadyExistsError,
    );
  });

  it('only lets owners pass the owner check', () => {
    const workspace = newWorkspace();
    const admin = UserId.create();
    workspace.addMember(admin, WorkspaceRole.ADMIN, NOW);

    expect(() => workspace.assertOwner(OWNER)).not.toThrow();
    expect(() => workspace.assertOwner(admin)).toThrow(WorkspaceOwnerRequiredError);
    expect(() => workspace.assertOwner(UserId.create())).toThrow(WorkspaceOwnerRequiredError);
  });

  it('changes the role of a member', () => {
    const workspace = newWorkspace();
    const user = UserId.create();
    workspace.addMember(user, WorkspaceRole.ADMIN, NOW);

    workspace.changeRole(user, WorkspaceRole.OWNER, NOW);

    expect(workspace.roleOf(user)).toBe(WorkspaceRole.OWNER);
    expect(() => workspace.changeRole(UserId.create(), WorkspaceRole.ADMIN, NOW)).toThrow(
      WorkspaceMemberNotFoundError,
    );
  });

  it('keeps at least one owner when demoting', () => {
    const workspace = newWorkspace();

    expect(() => workspace.changeRole(OWNER, WorkspaceRole.ADMIN, NOW)).toThrow(
      LastWorkspaceOwnerRequiredError,
    );

    const second = UserId.create();
    workspace.addMember(second, WorkspaceRole.OWNER, NOW);
    workspace.changeRole(OWNER, WorkspaceRole.ADMIN, NOW);
    expect(workspace.roleOf(OWNER)).toBe(WorkspaceRole.ADMIN);
    expect(() => workspace.changeRole(second, WorkspaceRole.ADMIN, NOW)).toThrow(
      LastWorkspaceOwnerRequiredError,
    );
  });

  it('keeps at least one owner when removing', () => {
    const workspace = newWorkspace();
    const admin = UserId.create();
    workspace.addMember(admin, WorkspaceRole.ADMIN, NOW);

    expect(() => workspace.removeMember(OWNER, NOW)).toThrow(LastWorkspaceOwnerRequiredError);
    workspace.removeMember(admin, NOW);
    expect(workspace.roleOf(admin)).toBeNull();
    expect(() => workspace.removeMember(admin, NOW)).toThrow(WorkspaceMemberNotFoundError);
  });

  it('raises an event for create and every mutation, once', () => {
    const workspace = newWorkspace();
    const user = UserId.create();
    expect(workspace.pullEvents()).toMatchObject([
      {
        name: WorkspaceEventNames.CREATED,
        aggregateId: workspace.id.value,
        tenantId: workspace.tenantId.value,
        ownerId: OWNER.value,
        workspaceName: 'Acme',
        occurredAt: CREATED_AT.toISOString(),
      },
    ]);

    workspace.rename(WorkspaceName.create('Beta'), NOW);
    workspace.addMember(user, WorkspaceRole.ADMIN, NOW);
    workspace.changeRole(user, WorkspaceRole.OWNER, NOW);
    workspace.removeMember(user, LATER);

    expect(workspace.pullEvents()).toMatchObject([
      { name: WorkspaceEventNames.RENAMED, workspaceName: 'Beta', occurredAt: NOW.toISOString() },
      { name: WorkspaceEventNames.MEMBER_ADDED, userId: user.value, role: WorkspaceRole.ADMIN },
      {
        name: WorkspaceEventNames.MEMBER_ROLE_CHANGED,
        userId: user.value,
        previousRole: WorkspaceRole.ADMIN,
        role: WorkspaceRole.OWNER,
      },
      {
        name: WorkspaceEventNames.MEMBER_REMOVED,
        userId: user.value,
        occurredAt: LATER.toISOString(),
      },
    ]);
    expect(workspace.pullEvents()).toEqual([]);
  });

  it('raises no event when a mutation is rejected or on restore', () => {
    const workspace = newWorkspace();
    workspace.pullEvents();

    expect(() => workspace.removeMember(OWNER, NOW)).toThrow(LastWorkspaceOwnerRequiredError);
    expect(workspace.pullEvents()).toEqual([]);

    const restored = Workspace.restore(
      {
        tenantId: TenantId.create(),
        name: WorkspaceName.restore('Acme'),
        roles: new Map(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      WorkspaceId.create(),
    );
    expect(restored.pullEvents()).toEqual([]);
  });

  it('finds a member by an equal id that is a different instance', () => {
    const workspace = newWorkspace();
    const sameOwner = UserId.restore(OWNER.value);

    expect(workspace.roleOf(sameOwner)).toBe(WorkspaceRole.OWNER);
    expect(() => workspace.assertOwner(sameOwner)).not.toThrow();
    expect(() => workspace.addMember(sameOwner, WorkspaceRole.ADMIN, NOW)).toThrow(
      WorkspaceMemberAlreadyExistsError,
    );
  });

  it('lets an owner be removed once another owner exists', () => {
    const workspace = newWorkspace();
    workspace.addMember(UserId.create(), WorkspaceRole.OWNER, NOW);

    workspace.removeMember(OWNER, NOW);

    expect(workspace.roleOf(OWNER)).toBeNull();
  });
});
