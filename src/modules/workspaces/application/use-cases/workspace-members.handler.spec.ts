import { Email, InvalidEmailError } from '@common/primitives';
import { TenantId } from '@modules/tenants';
import { EmailAlreadyTakenError, User, UserId, UserName } from '@modules/users';

import { WORKSPACE_VIEW_MEMBER_LIMIT } from '../ports/workspace.query.js';
import { WorkspaceId } from '../../domain/value-objects/workspace-id.js';

import {
  LastWorkspaceOwnerRequiredError,
  WorkspaceMemberAlreadyExistsError,
  WorkspaceMemberNotFoundError,
  WorkspaceNotFoundError,
  WorkspaceOwnerRequiredError,
  WorkspacePermissionDeniedError,
  WorkspaceRoleNotFoundError,
} from '../../domain/errors/domain.error.js';
import { SystemRoleId } from '../../domain/value-objects/system-workspace-role.js';
import { WorkspaceRoleId } from '../../domain/value-objects/workspace-role-id.js';
import { type WorkspaceKit, createWorkspaceKit } from '../../testing/fakes.js';
import { AddWorkspaceMemberCommand } from './add-workspace-member/add-workspace-member.command.js';
import { ChangeWorkspaceMemberRoleCommand } from './change-workspace-member-role/change-workspace-member-role.command.js';
import { GetWorkspaceQuery } from './get-workspace/get-workspace.query.js';
import { LeaveWorkspaceCommand } from './leave-workspace/leave-workspace.command.js';
import { ListWorkspaceMembersQuery } from './list-workspace-members/list-workspace-members.query.js';
import { RemoveWorkspaceMemberCommand } from './remove-workspace-member/remove-workspace-member.command.js';

const addMember = (
  kit: WorkspaceKit,
  email: string,
  role: WorkspaceRoleId = SystemRoleId.ADMIN,
  actor = kit.owner.id,
) =>
  kit.add.execute(
    new AddWorkspaceMemberCommand(
      actor.value,
      kit.tenantId.value,
      kit.workspace.id.value,
      email,
      'New Person',
      role.value,
    ),
  );

const addMembers = async (kit: WorkspaceKit, count: number): Promise<UserId[]> => {
  const ids: UserId[] = [];
  for (let index = 0; index < count; index++) {
    ids.push((await addMember(kit, `member${index}@acme.co`)).userId);
  }
  return ids;
};

const getView = (kit: WorkspaceKit, actor: UserId) =>
  kit.get.execute(new GetWorkspaceQuery(actor.value, kit.tenantId.value, kit.workspace.id.value));

const list = (kit: WorkspaceKit, actor: UserId, page: number, limit: number) =>
  kit.list.execute(
    new ListWorkspaceMembersQuery(
      actor.value,
      kit.tenantId.value,
      kit.workspace.id.value,
      page,
      limit,
    ),
  );

describe('AddWorkspaceMemberHandler', () => {
  it('makes a new email a user of the tenant and a member at once', async () => {
    const kit = createWorkspaceKit();

    const { userId } = await addMember(kit, ' New@Acme.co ');

    const user = kit.users.saved.get(userId.value);
    expect(user?.email.value).toBe('new@acme.co');
    expect(user?.tenantId).toEqual(kit.tenantId);
    expect(user?.name.value).toBe('New Person');
    expect(kit.members.roleOf(userId)).toEqual(SystemRoleId.ADMIN);
  });

  it('adds an existing user of the same tenant without creating another user', async () => {
    const kit = createWorkspaceKit();
    const first = await addMember(kit, 'new@acme.co');
    const member = await kit.members.findByUser(kit.tenantId, kit.workspace.id, first.userId);
    if (member) {
      await kit.members.delete(member);
    }

    const again = await addMember(kit, 'new@acme.co', SystemRoleId.OWNER);

    expect(again.userId).toEqual(first.userId);
    expect(kit.users.saved.size).toBe(2);
    expect(kit.members.roleOf(first.userId)).toEqual(SystemRoleId.OWNER);
  });

  it('lets an owner add another owner', async () => {
    const kit = createWorkspaceKit();

    const { userId } = await addMember(kit, 'second@acme.co', SystemRoleId.OWNER);

    expect(kit.members.roleOf(userId)).toEqual(SystemRoleId.OWNER);
  });

  it('lets an admin add a non-owner but not an owner', async () => {
    const kit = createWorkspaceKit();
    const admin = await addMember(kit, 'admin@acme.co');

    const { userId } = await addMember(kit, 'x@acme.co', SystemRoleId.MEMBER, admin.userId);

    expect(kit.members.roleOf(userId)).toEqual(SystemRoleId.MEMBER);
    await expect(addMember(kit, 'y@acme.co', SystemRoleId.OWNER, admin.userId)).rejects.toThrow(
      WorkspaceOwnerRequiredError,
    );
  });

  it('refuses members and outsiders, who hold no add permission', async () => {
    const kit = createWorkspaceKit();
    const member = await addMember(kit, 'member@acme.co', SystemRoleId.MEMBER);

    await expect(addMember(kit, 'x@acme.co', SystemRoleId.MEMBER, member.userId)).rejects.toThrow(
      WorkspacePermissionDeniedError,
    );
    await expect(addMember(kit, 'x@acme.co', SystemRoleId.MEMBER, UserId.create())).rejects.toThrow(
      WorkspacePermissionDeniedError,
    );
    expect(kit.users.saved.size).toBe(2);
  });

  it('refuses a role the workspace does not have', async () => {
    const kit = createWorkspaceKit();

    await expect(addMember(kit, 'x@acme.co', WorkspaceRoleId.create())).rejects.toThrow(
      WorkspaceRoleNotFoundError,
    );
    expect(kit.users.saved.size).toBe(1);
  });

  it('refuses an email that belongs to a user of another tenant', async () => {
    const kit = createWorkspaceKit();
    await kit.users.save(
      User.create({
        tenantId: TenantId.create(),
        email: Email.create('other@beta.co'),
        name: UserName.create('Other'),
        createdAt: new Date(),
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
    const add = (tenantId: TenantId, workspaceId: WorkspaceId) =>
      kit.add.execute(
        new AddWorkspaceMemberCommand(
          kit.owner.id.value,
          tenantId.value,
          workspaceId.value,
          'a@b.co',
          'x',
          SystemRoleId.ADMIN.value,
        ),
      );
    await expect(add(TenantId.create(), kit.workspace.id)).rejects.toThrow(WorkspaceNotFoundError);
    await expect(add(kit.tenantId, WorkspaceId.create())).rejects.toThrow(WorkspaceNotFoundError);
  });
});

describe('ChangeWorkspaceMemberRoleHandler', () => {
  it('lets an owner change a role', async () => {
    const kit = createWorkspaceKit();
    const { userId } = await addMember(kit, 'new@acme.co');

    await kit.changeRole.execute(
      new ChangeWorkspaceMemberRoleCommand(
        kit.owner.id.value,
        kit.tenantId.value,
        kit.workspace.id.value,
        userId.value,
        SystemRoleId.OWNER.value,
      ),
    );

    expect(kit.members.roleOf(userId)).toEqual(SystemRoleId.OWNER);
  });

  it('refuses non-owners, unknown members and demoting the last owner', async () => {
    const kit = createWorkspaceKit();
    const { userId } = await addMember(kit, 'new@acme.co');
    const change = (actor: typeof userId, target: typeof userId, role: WorkspaceRoleId) =>
      kit.changeRole.execute(
        new ChangeWorkspaceMemberRoleCommand(
          actor.value,
          kit.tenantId.value,
          kit.workspace.id.value,
          target.value,
          role.value,
        ),
      );

    await expect(change(userId, userId, SystemRoleId.OWNER)).rejects.toThrow(
      WorkspaceOwnerRequiredError,
    );
    await expect(change(kit.owner.id, UserId.create(), SystemRoleId.ADMIN)).rejects.toThrow(
      WorkspaceMemberNotFoundError,
    );
    await expect(change(kit.owner.id, kit.owner.id, SystemRoleId.ADMIN)).rejects.toThrow(
      LastWorkspaceOwnerRequiredError,
    );
  });
});

describe('RemoveWorkspaceMemberHandler', () => {
  it('lets an owner remove a member but never the last owner', async () => {
    const kit = createWorkspaceKit();
    const { userId } = await addMember(kit, 'new@acme.co');
    const remove = (actor: typeof userId, target: typeof userId) =>
      kit.remove.execute(
        new RemoveWorkspaceMemberCommand(
          actor.value,
          kit.tenantId.value,
          kit.workspace.id.value,
          target.value,
        ),
      );

    await expect(remove(userId, kit.owner.id)).rejects.toThrow(WorkspaceOwnerRequiredError);
    await expect(remove(kit.owner.id, kit.owner.id)).rejects.toThrow(
      LastWorkspaceOwnerRequiredError,
    );
    await remove(kit.owner.id, userId);

    expect(kit.members.roleOf(userId)).toBeNull();
    expect(await kit.users.findById(kit.tenantId, userId)).toBeNull();
    await expect(remove(kit.owner.id, userId)).rejects.toThrow(WorkspaceMemberNotFoundError);
  });
});

describe('LeaveWorkspaceHandler', () => {
  it('lets any member leave, except the last owner', async () => {
    const kit = createWorkspaceKit();
    const { userId } = await addMember(kit, 'new@acme.co');
    const leave = (actor: typeof userId) =>
      kit.leave.execute(
        new LeaveWorkspaceCommand(actor.value, kit.tenantId.value, kit.workspace.id.value),
      );

    await expect(leave(kit.owner.id)).rejects.toThrow(LastWorkspaceOwnerRequiredError);
    await leave(userId);

    expect(kit.members.roleOf(userId)).toBeNull();
    expect(await kit.users.findById(kit.tenantId, userId)).toBeNull();
    await expect(leave(userId)).rejects.toThrow(WorkspaceMemberNotFoundError);
  });

  it('lets an owner leave once another owner exists', async () => {
    const kit = createWorkspaceKit();
    await addMember(kit, 'second@acme.co', SystemRoleId.OWNER);

    await kit.leave.execute(
      new LeaveWorkspaceCommand(kit.owner.id.value, kit.tenantId.value, kit.workspace.id.value),
    );

    expect(kit.members.roleOf(kit.owner.id)).toBeNull();
  });
});

describe('GetWorkspaceHandler', () => {
  it('returns the workspace with its members and the role of the caller', async () => {
    const kit = createWorkspaceKit();
    const { userId } = await addMember(kit, 'new@acme.co');

    const view = await getView(kit, userId);

    expect(view).toEqual({
      id: kit.workspace.id,
      name: 'Acme',
      roleId: SystemRoleId.ADMIN,
      role: 'admin',
      memberCount: 2,
      members: [
        {
          userId,
          name: 'New Person',
          email: 'new@acme.co',
          roleId: SystemRoleId.ADMIN,
          role: 'admin',
        },
        {
          userId: kit.owner.id,
          name: 'Owner',
          email: 'owner@acme.co',
          roleId: SystemRoleId.OWNER,
          role: 'owner',
        },
      ],
    });
  });

  it('previews only the newest members but counts all of them', async () => {
    const kit = createWorkspaceKit();
    const added = await addMembers(kit, WORKSPACE_VIEW_MEMBER_LIMIT + 2);

    const view = await getView(kit, kit.owner.id);

    expect(view.memberCount).toBe(WORKSPACE_VIEW_MEMBER_LIMIT + 3);
    expect(view.members.map((member) => member.userId)).toEqual(
      added.slice(-WORKSPACE_VIEW_MEMBER_LIMIT).reverse(),
    );
  });

  it('fails for a caller who is not a member, an unknown workspace and a workspace of another tenant', async () => {
    const kit = createWorkspaceKit();

    await expect(getView(kit, UserId.create())).rejects.toThrow(WorkspaceNotFoundError);
    await expect(
      kit.get.execute(
        new GetWorkspaceQuery(kit.owner.id.value, kit.tenantId.value, WorkspaceId.create().value),
      ),
    ).rejects.toThrow(WorkspaceNotFoundError);
    await expect(
      kit.get.execute(
        new GetWorkspaceQuery(kit.owner.id.value, TenantId.create().value, kit.workspace.id.value),
      ),
    ).rejects.toThrow(WorkspaceNotFoundError);
  });
});

describe('ListWorkspaceMembersHandler', () => {
  it('pages the members newest first with the total', async () => {
    const kit = createWorkspaceKit();
    const added = await addMembers(kit, 4);
    const newestFirst = [...added.reverse(), kit.owner.id];

    const first = await list(kit, kit.owner.id, 1, 2);
    const second = await list(kit, kit.owner.id, 2, 2);
    const last = await list(kit, kit.owner.id, 3, 2);

    expect(first).toMatchObject({ page: 1, limit: 2, total: 5 });
    expect(first.items.map((member) => member.userId)).toEqual(newestFirst.slice(0, 2));
    expect(second.items.map((member) => member.userId)).toEqual(newestFirst.slice(2, 4));
    expect(last.items.map((member) => member.userId)).toEqual(newestFirst.slice(4));
  });

  it('fails for a caller who is not a member, an unknown workspace and a workspace of another tenant', async () => {
    const kit = createWorkspaceKit();

    await expect(list(kit, UserId.create(), 1, 20)).rejects.toThrow(WorkspaceNotFoundError);
    await expect(
      kit.list.execute(
        new ListWorkspaceMembersQuery(
          kit.owner.id.value,
          kit.tenantId.value,
          WorkspaceId.create().value,
          1,
          20,
        ),
      ),
    ).rejects.toThrow(WorkspaceNotFoundError);
    await expect(
      kit.list.execute(
        new ListWorkspaceMembersQuery(
          kit.owner.id.value,
          TenantId.create().value,
          kit.workspace.id.value,
          1,
          20,
        ),
      ),
    ).rejects.toThrow(WorkspaceNotFoundError);
  });
});
