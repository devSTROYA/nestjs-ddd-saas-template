import { TenantId } from '@modules/tenants';
import { UserId } from '@modules/users';

import { WorkspaceRole } from '../../domain/entities/workspace-role.js';
import {
  SystemWorkspaceRoleError,
  WorkspaceNotFoundError,
  WorkspaceOwnerRequiredError,
  WorkspacePermissionDeniedError,
  WorkspaceRoleInUseError,
  WorkspaceRoleKeyTakenError,
  WorkspaceRoleNotFoundError,
} from '../../domain/errors/domain.error.js';
import { SystemRoleId } from '../../domain/value-objects/system-workspace-role.js';
import { WorkspaceId } from '../../domain/value-objects/workspace-id.js';
import { WorkspacePermission } from '../../domain/value-objects/workspace-permission.js';
import type { WorkspaceRoleId } from '../../domain/value-objects/workspace-role-id.js';
import { type WorkspaceKit, createWorkspaceKit } from '../../testing/fakes.js';
import { AddWorkspaceMemberCommand } from './add-workspace-member/add-workspace-member.command.js';
import { ChangeWorkspaceMemberRoleCommand } from './change-workspace-member-role/change-workspace-member-role.command.js';
import { CreateWorkspaceRoleCommand } from './create-workspace-role/create-workspace-role.command.js';
import { DeleteWorkspaceRoleCommand } from './delete-workspace-role/delete-workspace-role.command.js';
import { ListWorkspaceRolesQuery } from '../queries/list-workspace-roles/list-workspace-roles.query.js';
import { RemoveWorkspaceMemberCommand } from './remove-workspace-member/remove-workspace-member.command.js';
import { UpdateWorkspaceRoleCommand } from './update-workspace-role/update-workspace-role.command.js';

const { MEMBER_ADD, MEMBER_CHANGE_ROLE, MEMBER_REMOVE, ROLE_MANAGE } = WorkspacePermission;

const createRole = async (
  kit: WorkspaceKit,
  key: string,
  permissions: readonly WorkspacePermission[],
  actor = kit.owner.id,
): Promise<WorkspaceRoleId> => {
  const { id } = await kit.createRole.execute(
    new CreateWorkspaceRoleCommand(actor, kit.tenantId, kit.workspace.id, key, key, permissions),
  );
  return id;
};

const updateRole = (
  kit: WorkspaceKit,
  role: WorkspaceRoleId,
  permissions: readonly WorkspacePermission[],
  actor = kit.owner.id,
) =>
  kit.updateRole.execute(
    new UpdateWorkspaceRoleCommand(
      actor,
      kit.tenantId,
      kit.workspace.id,
      role,
      'Renamed',
      permissions,
    ),
  );

const deleteRole = (kit: WorkspaceKit, role: WorkspaceRoleId, actor = kit.owner.id) =>
  kit.deleteRole.execute(
    new DeleteWorkspaceRoleCommand(actor, kit.tenantId, kit.workspace.id, role),
  );

const addMember = async (
  kit: WorkspaceKit,
  email: string,
  role: WorkspaceRoleId,
  actor = kit.owner.id,
): Promise<UserId> => {
  const { userId } = await kit.add.execute(
    new AddWorkspaceMemberCommand(actor, kit.tenantId, kit.workspace.id, email, 'New Person', role),
  );
  return userId;
};

const changeRole = (kit: WorkspaceKit, actor: UserId, target: UserId, role: WorkspaceRoleId) =>
  kit.changeRole.execute(
    new ChangeWorkspaceMemberRoleCommand(actor, kit.tenantId, kit.workspace.id, target, role),
  );

const removeMember = (kit: WorkspaceKit, actor: UserId, target: UserId) =>
  kit.remove.execute(
    new RemoveWorkspaceMemberCommand(actor, kit.tenantId, kit.workspace.id, target),
  );

const listRoles = (kit: WorkspaceKit, actor: UserId) =>
  kit.listRoles.execute(new ListWorkspaceRolesQuery(actor, kit.tenantId, kit.workspace.id));

describe('workspace roles', () => {
  it('lists the system roles and the custom ones of the workspace only', async () => {
    const kit = createWorkspaceKit();
    const id = await createRole(kit, 'reviewer', [MEMBER_ADD]);
    await kit.roles.save(
      WorkspaceRole.create({
        tenantId: TenantId.generate(),
        workspaceId: WorkspaceId.generate(),
        key: 'elsewhere',
        name: 'Elsewhere',
        permissions: [],
        createdAt: new Date(),
      }),
    );

    const roles = await listRoles(kit, kit.owner.id);

    expect(roles.map(({ key, system }) => ({ key, system }))).toEqual([
      { key: 'owner', system: true },
      { key: 'admin', system: true },
      { key: 'member', system: true },
      { key: 'reviewer', system: false },
    ]);
    expect(roles[3]).toMatchObject({ id, permissions: [MEMBER_ADD] });
  });

  it('shows the roles to any member and to no outsider', async () => {
    const kit = createWorkspaceKit();
    const member = await addMember(kit, 'm@acme.co', SystemRoleId.MEMBER);

    await expect(listRoles(kit, member)).resolves.toHaveLength(3);
    await expect(listRoles(kit, UserId.generate())).rejects.toThrow(WorkspaceNotFoundError);
  });

  it('gives a member the permissions of a custom role', async () => {
    const kit = createWorkspaceKit();
    const recruiterRole = await createRole(kit, 'recruiter', [MEMBER_ADD]);
    const recruiter = await addMember(kit, 'r@acme.co', recruiterRole);
    const target = await addMember(kit, 'm@acme.co', SystemRoleId.MEMBER, recruiter);

    await expect(removeMember(kit, recruiter, target)).rejects.toThrow(
      WorkspacePermissionDeniedError,
    );
  });

  it('applies an updated role to the members who hold it', async () => {
    const kit = createWorkspaceKit();
    const recruiterRole = await createRole(kit, 'recruiter', [MEMBER_ADD]);
    const recruiter = await addMember(kit, 'r@acme.co', recruiterRole);

    await updateRole(kit, recruiterRole, []);

    await expect(addMember(kit, 'x@acme.co', SystemRoleId.MEMBER, recruiter)).rejects.toThrow(
      WorkspacePermissionDeniedError,
    );
  });

  it('never changes or deletes a system role, even for an owner', async () => {
    const kit = createWorkspaceKit();

    await expect(updateRole(kit, SystemRoleId.ADMIN, [])).rejects.toThrow(SystemWorkspaceRoleError);
    await expect(deleteRole(kit, SystemRoleId.MEMBER)).rejects.toThrow(SystemWorkspaceRoleError);
  });

  it('refuses a custom role of another workspace', async () => {
    const kit = createWorkspaceKit();
    const elsewhere = WorkspaceRole.create({
      tenantId: TenantId.generate(),
      workspaceId: WorkspaceId.generate(),
      key: 'elsewhere',
      name: 'Elsewhere',
      permissions: [],
      createdAt: new Date(),
    });
    await kit.roles.save(elsewhere);

    await expect(addMember(kit, 'x@acme.co', elsewhere.id)).rejects.toThrow(
      WorkspaceRoleNotFoundError,
    );
    await expect(updateRole(kit, elsewhere.id, [])).rejects.toThrow(WorkspaceRoleNotFoundError);
    await expect(deleteRole(kit, elsewhere.id)).rejects.toThrow(WorkspaceRoleNotFoundError);
  });

  it('keeps role management to holders of the permission', async () => {
    const kit = createWorkspaceKit();
    const admin = await addMember(kit, 'a@acme.co', SystemRoleId.ADMIN);
    const reviewer = await createRole(kit, 'reviewer', []);

    await expect(createRole(kit, 'x', [], admin)).rejects.toThrow(WorkspacePermissionDeniedError);
    await expect(updateRole(kit, reviewer, [], admin)).rejects.toThrow(
      WorkspacePermissionDeniedError,
    );
    await expect(deleteRole(kit, reviewer, admin)).rejects.toThrow(WorkspacePermissionDeniedError);
  });

  it('never lets a role manager hand out or edit in more than it holds', async () => {
    const kit = createWorkspaceKit();
    const editorRole = await createRole(kit, 'role-editor', [ROLE_MANAGE]);
    const wide = await createRole(kit, 'wide', [ROLE_MANAGE, MEMBER_REMOVE]);
    const editor = await addMember(kit, 'e@acme.co', editorRole);

    await expect(createRole(kit, 'x', [MEMBER_REMOVE], editor)).rejects.toThrow(
      WorkspacePermissionDeniedError,
    );
    await expect(updateRole(kit, editorRole, [ROLE_MANAGE, MEMBER_REMOVE], editor)).rejects.toThrow(
      WorkspacePermissionDeniedError,
    );
    await expect(updateRole(kit, wide, [], editor)).rejects.toThrow(WorkspacePermissionDeniedError);
    await expect(deleteRole(kit, wide, editor)).rejects.toThrow(WorkspacePermissionDeniedError);
  });

  it('stops an admin from giving themself role management through a custom role', async () => {
    const kit = createWorkspaceKit();
    const editorRole = await createRole(kit, 'role-editor', [ROLE_MANAGE]);
    const admin = await addMember(kit, 'a@acme.co', SystemRoleId.ADMIN);

    await expect(changeRole(kit, admin, admin, editorRole)).rejects.toThrow(
      WorkspacePermissionDeniedError,
    );
    await expect(addMember(kit, 'x@acme.co', editorRole, admin)).rejects.toThrow(
      WorkspacePermissionDeniedError,
    );
  });

  it('keeps owners out of reach of a custom role with every permission', async () => {
    const kit = createWorkspaceKit();
    const superRole = await createRole(kit, 'super', [
      MEMBER_ADD,
      MEMBER_CHANGE_ROLE,
      MEMBER_REMOVE,
      ROLE_MANAGE,
    ]);
    const superUser = await addMember(kit, 's@acme.co', superRole);

    await expect(removeMember(kit, superUser, kit.owner.id)).rejects.toThrow(
      WorkspaceOwnerRequiredError,
    );
    await expect(changeRole(kit, superUser, kit.owner.id, superRole)).rejects.toThrow(
      WorkspaceOwnerRequiredError,
    );
    await expect(changeRole(kit, superUser, superUser, SystemRoleId.OWNER)).rejects.toThrow(
      WorkspaceOwnerRequiredError,
    );
  });

  it('lets an admin manage non-owners', async () => {
    const kit = createWorkspaceKit();
    const admin = await addMember(kit, 'a@acme.co', SystemRoleId.ADMIN);
    const member = await addMember(kit, 'm@acme.co', SystemRoleId.MEMBER, admin);

    await changeRole(kit, admin, member, SystemRoleId.ADMIN);
    expect(kit.members.roleOf(member)).toEqual(SystemRoleId.ADMIN);

    await removeMember(kit, admin, member);
    expect(kit.members.roleOf(member)).toBeNull();
    await expect(removeMember(kit, admin, kit.owner.id)).rejects.toThrow(
      WorkspaceOwnerRequiredError,
    );
  });

  it('refuses a taken key', async () => {
    const kit = createWorkspaceKit();
    await createRole(kit, 'reviewer', []);

    await expect(createRole(kit, 'reviewer', [])).rejects.toThrow(WorkspaceRoleKeyTakenError);
    await expect(createRole(kit, 'owner', [])).rejects.toThrow(WorkspaceRoleKeyTakenError);
  });

  it('deletes a role only once nobody holds it', async () => {
    const kit = createWorkspaceKit();
    const reviewer = await createRole(kit, 'reviewer', []);
    const member = await addMember(kit, 'r@acme.co', reviewer);

    await expect(deleteRole(kit, reviewer)).rejects.toThrow(WorkspaceRoleInUseError);

    await changeRole(kit, kit.owner.id, member, SystemRoleId.MEMBER);
    await deleteRole(kit, reviewer);

    await expect(addMember(kit, 'x@acme.co', reviewer)).rejects.toThrow(WorkspaceRoleNotFoundError);
  });
});
