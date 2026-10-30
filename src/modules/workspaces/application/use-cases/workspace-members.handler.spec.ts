import { Email, InvalidEmailError } from '@common/primitives';
import { newTenantId } from '@modules/tenants';
import { EmailAlreadyTakenError, User, UserName, newUserId } from '@modules/users';

import {
  LastWorkspaceOwnerRequiredError,
  WorkspaceMemberAlreadyExistsError,
  WorkspaceMemberNotFoundError,
  WorkspaceNotFoundError,
  WorkspaceOwnerRequiredError,
} from '../../domain/errors/domain.error.js';
import { WorkspaceRole } from '../../domain/value-objects/workspace-role.js';
import { type WorkspaceKit, createWorkspaceKit } from '../../testing/fakes.js';
import { AddWorkspaceMemberCommand } from './add-workspace-member/add-workspace-member.command.js';
import { ChangeWorkspaceMemberRoleCommand } from './change-workspace-member-role/change-workspace-member-role.command.js';
import { GetWorkspaceQuery } from './get-workspace/get-workspace.query.js';
import { LeaveWorkspaceCommand } from './leave-workspace/leave-workspace.command.js';
import { RemoveWorkspaceMemberCommand } from './remove-workspace-member/remove-workspace-member.command.js';

const addMember = (
  kit: WorkspaceKit,
  email: string,
  role: WorkspaceRole = WorkspaceRole.ADMIN,
  actor = kit.owner.id,
) => kit.add.execute(new AddWorkspaceMemberCommand(actor, kit.tenantId, email, 'New Person', role));

describe('AddWorkspaceMemberHandler', () => {
  it('makes a new email a user of the tenant and a member at once', async () => {
    const kit = createWorkspaceKit();

    const { userId } = await addMember(kit, ' New@Acme.co ');

    const user = kit.users.saved.get(userId);
    expect(user?.email.value).toBe('new@acme.co');
    expect(user?.tenantId).toBe(kit.tenantId);
    expect(user?.name.value).toBe('New Person');
    expect(kit.workspace.roleOf(userId)).toBe(WorkspaceRole.ADMIN);
  });

  it('adds an existing user of the same tenant without creating another user', async () => {
    const kit = createWorkspaceKit();
    const first = await addMember(kit, 'new@acme.co');
    kit.workspace.removeMember(first.userId);

    const again = await addMember(kit, 'new@acme.co', WorkspaceRole.OWNER);

    expect(again.userId).toBe(first.userId);
    expect(kit.users.saved.size).toBe(2);
    expect(kit.workspace.roleOf(first.userId)).toBe(WorkspaceRole.OWNER);
  });

  it('lets an owner add another owner', async () => {
    const kit = createWorkspaceKit();

    const { userId } = await addMember(kit, 'second@acme.co', WorkspaceRole.OWNER);

    expect(kit.workspace.roleOf(userId)).toBe(WorkspaceRole.OWNER);
  });

  it('refuses an actor who is not an owner, including admins and outsiders', async () => {
    const kit = createWorkspaceKit();
    const admin = await addMember(kit, 'admin@acme.co');

    await expect(addMember(kit, 'x@acme.co', WorkspaceRole.ADMIN, admin.userId)).rejects.toThrow(
      WorkspaceOwnerRequiredError,
    );
    await expect(addMember(kit, 'x@acme.co', WorkspaceRole.ADMIN, newUserId())).rejects.toThrow(
      WorkspaceOwnerRequiredError,
    );
    expect(kit.users.saved.size).toBe(2);
  });

  it('refuses an email that belongs to a user of another tenant', async () => {
    const kit = createWorkspaceKit();
    await kit.users.save(
      User.create({
        id: newUserId(),
        tenantId: newTenantId(),
        email: Email.create('other@beta.co'),
        name: UserName.create('Other'),
      }),
    );

    await expect(addMember(kit, 'other@beta.co')).rejects.toThrow(EmailAlreadyTakenError);
  });

  it('refuses a user who is already a member', async () => {
    const kit = createWorkspaceKit();
    await addMember(kit, 'new@acme.co');

    await expect(addMember(kit, 'new@acme.co')).rejects.toThrow(WorkspaceMemberAlreadyExistsError);
  });

  it('rejects an invalid email and an unknown workspace', async () => {
    const kit = createWorkspaceKit();

    await expect(addMember(kit, 'nope')).rejects.toThrow(InvalidEmailError);
    await expect(
      kit.add.execute(
        new AddWorkspaceMemberCommand(
          kit.owner.id,
          newTenantId(),
          'a@b.co',
          'x',
          WorkspaceRole.ADMIN,
        ),
      ),
    ).rejects.toThrow(WorkspaceNotFoundError);
  });
});

describe('ChangeWorkspaceMemberRoleHandler', () => {
  it('lets an owner change a role', async () => {
    const kit = createWorkspaceKit();
    const { userId } = await addMember(kit, 'new@acme.co');

    await kit.changeRole.execute(
      new ChangeWorkspaceMemberRoleCommand(kit.owner.id, kit.tenantId, userId, WorkspaceRole.OWNER),
    );

    expect(kit.workspace.roleOf(userId)).toBe(WorkspaceRole.OWNER);
  });

  it('refuses non-owners, unknown members and demoting the last owner', async () => {
    const kit = createWorkspaceKit();
    const { userId } = await addMember(kit, 'new@acme.co');
    const change = (actor: typeof userId, target: typeof userId, role: WorkspaceRole) =>
      kit.changeRole.execute(
        new ChangeWorkspaceMemberRoleCommand(actor, kit.tenantId, target, role),
      );

    await expect(change(userId, userId, WorkspaceRole.OWNER)).rejects.toThrow(
      WorkspaceOwnerRequiredError,
    );
    await expect(change(kit.owner.id, newUserId(), WorkspaceRole.ADMIN)).rejects.toThrow(
      WorkspaceMemberNotFoundError,
    );
    await expect(change(kit.owner.id, kit.owner.id, WorkspaceRole.ADMIN)).rejects.toThrow(
      LastWorkspaceOwnerRequiredError,
    );
  });
});

describe('RemoveWorkspaceMemberHandler', () => {
  it('lets an owner remove a member but never the last owner', async () => {
    const kit = createWorkspaceKit();
    const { userId } = await addMember(kit, 'new@acme.co');
    const remove = (actor: typeof userId, target: typeof userId) =>
      kit.remove.execute(new RemoveWorkspaceMemberCommand(actor, kit.tenantId, target));

    await expect(remove(userId, kit.owner.id)).rejects.toThrow(WorkspaceOwnerRequiredError);
    await expect(remove(kit.owner.id, kit.owner.id)).rejects.toThrow(
      LastWorkspaceOwnerRequiredError,
    );
    await remove(kit.owner.id, userId);

    expect(kit.workspace.roleOf(userId)).toBeNull();
    expect(await kit.users.findById(kit.tenantId, userId)).toBeNull();
    await expect(remove(kit.owner.id, userId)).rejects.toThrow(WorkspaceMemberNotFoundError);
  });
});

describe('LeaveWorkspaceHandler', () => {
  it('lets any member leave, except the last owner', async () => {
    const kit = createWorkspaceKit();
    const { userId } = await addMember(kit, 'new@acme.co');
    const leave = (actor: typeof userId) =>
      kit.leave.execute(new LeaveWorkspaceCommand(actor, kit.tenantId));

    await expect(leave(kit.owner.id)).rejects.toThrow(LastWorkspaceOwnerRequiredError);
    await leave(userId);

    expect(kit.workspace.roleOf(userId)).toBeNull();
    expect(await kit.users.findById(kit.tenantId, userId)).toBeNull();
    await expect(leave(userId)).rejects.toThrow(WorkspaceMemberNotFoundError);
  });

  it('lets an owner leave once another owner exists', async () => {
    const kit = createWorkspaceKit();
    await addMember(kit, 'second@acme.co', WorkspaceRole.OWNER);

    await kit.leave.execute(new LeaveWorkspaceCommand(kit.owner.id, kit.tenantId));

    expect(kit.workspace.roleOf(kit.owner.id)).toBeNull();
  });
});

describe('GetWorkspaceHandler', () => {
  it('returns the workspace with its members and the role of the caller', async () => {
    const kit = createWorkspaceKit();
    const { userId } = await addMember(kit, 'new@acme.co');

    const view = await kit.get.execute(new GetWorkspaceQuery(userId, kit.tenantId));

    expect(view).toEqual({
      id: kit.workspace.id,
      name: 'Acme',
      role: WorkspaceRole.ADMIN,
      members: [
        { userId: kit.owner.id, role: WorkspaceRole.OWNER },
        { userId, role: WorkspaceRole.ADMIN },
      ],
    });
  });

  it('fails for a caller who is not a member and for an unknown workspace', async () => {
    const kit = createWorkspaceKit();

    await expect(kit.get.execute(new GetWorkspaceQuery(newUserId(), kit.tenantId))).rejects.toThrow(
      WorkspaceNotFoundError,
    );
    await expect(
      kit.get.execute(new GetWorkspaceQuery(kit.owner.id, newTenantId())),
    ).rejects.toThrow(WorkspaceNotFoundError);
  });
});
