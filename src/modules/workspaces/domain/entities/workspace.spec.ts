import { newTenantId } from '@modules/tenants';
import { newUserId } from '@modules/users';

import {
  LastWorkspaceOwnerRequiredError,
  WorkspaceMemberAlreadyExistsError,
  WorkspaceMemberNotFoundError,
  WorkspaceOwnerRequiredError,
} from '../errors/domain.error.js';
import { WorkspaceEventNames } from '../events/workspace.events.js';
import { newWorkspaceId } from '../value-objects/workspace-id.js';
import { WorkspaceName } from '../value-objects/workspace-name.js';
import { WorkspaceRole } from '../value-objects/workspace-role.js';
import { Workspace } from './workspace.js';

const OWNER = newUserId();

const newWorkspace = (): Workspace =>
  Workspace.create({
    id: newWorkspaceId(),
    tenantId: newTenantId(),
    name: WorkspaceName.create('Acme'),
    ownerId: OWNER,
  });

describe('Workspace', () => {
  it('starts with its creator as the only owner', () => {
    expect(newWorkspace().members).toEqual([{ userId: OWNER, role: WorkspaceRole.OWNER }]);
  });

  it('restores its members without validation', () => {
    const member = { userId: newUserId(), role: WorkspaceRole.ADMIN };
    const workspace = Workspace.restore({
      id: newWorkspaceId(),
      tenantId: newTenantId(),
      name: WorkspaceName.restore('Acme'),
      members: [member],
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });

    expect(workspace.members).toEqual([member]);
  });

  it('adds a member with a role, once', () => {
    const workspace = newWorkspace();
    const user = newUserId();

    workspace.addMember(user, WorkspaceRole.ADMIN);

    expect(workspace.roleOf(user)).toBe(WorkspaceRole.ADMIN);
    expect(() => workspace.addMember(user, WorkspaceRole.OWNER)).toThrow(
      WorkspaceMemberAlreadyExistsError,
    );
  });

  it('only lets owners pass the owner check', () => {
    const workspace = newWorkspace();
    const admin = newUserId();
    workspace.addMember(admin, WorkspaceRole.ADMIN);

    expect(() => workspace.assertOwner(OWNER)).not.toThrow();
    expect(() => workspace.assertOwner(admin)).toThrow(WorkspaceOwnerRequiredError);
    expect(() => workspace.assertOwner(newUserId())).toThrow(WorkspaceOwnerRequiredError);
  });

  it('changes the role of a member', () => {
    const workspace = newWorkspace();
    const user = newUserId();
    workspace.addMember(user, WorkspaceRole.ADMIN);

    workspace.changeRole(user, WorkspaceRole.OWNER);

    expect(workspace.roleOf(user)).toBe(WorkspaceRole.OWNER);
    expect(() => workspace.changeRole(newUserId(), WorkspaceRole.ADMIN)).toThrow(
      WorkspaceMemberNotFoundError,
    );
  });

  it('keeps at least one owner when demoting', () => {
    const workspace = newWorkspace();

    expect(() => workspace.changeRole(OWNER, WorkspaceRole.ADMIN)).toThrow(
      LastWorkspaceOwnerRequiredError,
    );

    const second = newUserId();
    workspace.addMember(second, WorkspaceRole.OWNER);
    workspace.changeRole(OWNER, WorkspaceRole.ADMIN);
    expect(workspace.roleOf(OWNER)).toBe(WorkspaceRole.ADMIN);
    expect(() => workspace.changeRole(second, WorkspaceRole.ADMIN)).toThrow(
      LastWorkspaceOwnerRequiredError,
    );
  });

  it('keeps at least one owner when removing', () => {
    const workspace = newWorkspace();
    const admin = newUserId();
    workspace.addMember(admin, WorkspaceRole.ADMIN);

    expect(() => workspace.removeMember(OWNER)).toThrow(LastWorkspaceOwnerRequiredError);
    workspace.removeMember(admin);
    expect(workspace.roleOf(admin)).toBeNull();
    expect(() => workspace.removeMember(admin)).toThrow(WorkspaceMemberNotFoundError);
  });

  it('raises an event for create and every mutation, once', () => {
    const workspace = newWorkspace();
    const user = newUserId();
    expect(workspace.pullEvents()).toMatchObject([
      {
        name: WorkspaceEventNames.CREATED,
        aggregateId: workspace.id,
        tenantId: workspace.tenantId,
        ownerId: OWNER,
        workspaceName: 'Acme',
      },
    ]);

    workspace.rename(WorkspaceName.create('Beta'));
    workspace.addMember(user, WorkspaceRole.ADMIN);
    workspace.changeRole(user, WorkspaceRole.OWNER);
    workspace.removeMember(user);

    expect(workspace.pullEvents()).toMatchObject([
      { name: WorkspaceEventNames.RENAMED, workspaceName: 'Beta' },
      { name: WorkspaceEventNames.MEMBER_ADDED, userId: user, role: WorkspaceRole.ADMIN },
      {
        name: WorkspaceEventNames.MEMBER_ROLE_CHANGED,
        userId: user,
        previousRole: WorkspaceRole.ADMIN,
        role: WorkspaceRole.OWNER,
      },
      { name: WorkspaceEventNames.MEMBER_REMOVED, userId: user },
    ]);
    expect(workspace.pullEvents()).toEqual([]);
  });

  it('raises no event when a mutation is rejected or on restore', () => {
    const workspace = newWorkspace();
    workspace.pullEvents();

    expect(() => workspace.removeMember(OWNER)).toThrow(LastWorkspaceOwnerRequiredError);
    expect(workspace.pullEvents()).toEqual([]);

    const restored = Workspace.restore({
      id: newWorkspaceId(),
      tenantId: newTenantId(),
      name: WorkspaceName.restore('Acme'),
      members: [],
      createdAt: new Date(),
    });
    expect(restored.pullEvents()).toEqual([]);
  });

  it('lets an owner be removed once another owner exists', () => {
    const workspace = newWorkspace();
    workspace.addMember(newUserId(), WorkspaceRole.OWNER);

    workspace.removeMember(OWNER);

    expect(workspace.roleOf(OWNER)).toBeNull();
  });
});
