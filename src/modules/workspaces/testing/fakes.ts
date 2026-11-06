import { SystemClock } from '@common/clock';
import type { UnitOfWork } from '@common/database';
import { Email } from '@common/primitives';
import type { Nullable } from '@common/types';
import { TenantId } from '@modules/tenants';
import {
  EmailAlreadyTakenError,
  User,
  UserId,
  UserName,
  type UserRepository,
} from '@modules/users';

import type {
  WorkspaceMemberQuery,
  WorkspaceMemberListItem,
} from '../application/ports/workspace-member.query.js';
import type { WorkspaceMemberRepository } from '../domain/ports/workspace-member.repository.js';
import type {
  WorkspaceRoleQuery,
  WorkspaceRoleListItem,
} from '../application/ports/workspace-role.query.js';
import type { WorkspaceRoleRepository } from '../domain/ports/workspace-role.repository.js';
import {
  WORKSPACE_VIEW_MEMBER_LIMIT,
  type WorkspaceQuery,
  type WorkspaceDetail,
} from '../application/ports/workspace.query.js';
import type { WorkspaceRepository } from '../domain/ports/workspace.repository.js';
import { AddWorkspaceMemberHandler } from '../application/commands/add-workspace-member/add-workspace-member.handler.js';
import { ChangeWorkspaceMemberRoleHandler } from '../application/commands/change-workspace-member-role/change-workspace-member-role.handler.js';
import { CreateWorkspaceRoleHandler } from '../application/commands/create-workspace-role/create-workspace-role.handler.js';
import { DeleteWorkspaceRoleHandler } from '../application/commands/delete-workspace-role/delete-workspace-role.handler.js';
import { GetWorkspaceHandler } from '../application/queries/get-workspace/get-workspace.handler.js';
import { LeaveWorkspaceHandler } from '../application/commands/leave-workspace/leave-workspace.handler.js';
import { ListWorkspaceMembersHandler } from '../application/queries/list-workspace-members/list-workspace-members.handler.js';
import { ListWorkspaceRolesHandler } from '../application/queries/list-workspace-roles/list-workspace-roles.handler.js';
import { RemoveWorkspaceMemberHandler } from '../application/commands/remove-workspace-member/remove-workspace-member.handler.js';
import { UpdateWorkspaceRoleHandler } from '../application/commands/update-workspace-role/update-workspace-role.handler.js';
import { WorkspaceAccess } from '../application/workspace-access.js';
import { WorkspaceMember } from '../domain/entities/workspace-member.js';
import type { WorkspaceRole } from '../domain/entities/workspace-role.js';
import { Workspace } from '../domain/entities/workspace.js';
import { WorkspaceRoleKeyTakenError } from '../domain/errors/domain.error.js';
import { SystemRoleId } from '../domain/value-objects/system-workspace-role.js';
import { WorkspaceId } from '../domain/value-objects/workspace-id.js';
import { WorkspaceName } from '../domain/value-objects/workspace-name.js';
import type { WorkspaceRoleId } from '../domain/value-objects/workspace-role-id.js';
import { systemRoles } from './system-roles.js';

export class FakeWorkspaces implements WorkspaceRepository {
  readonly saved = new Map<string, Workspace>();

  findById(tenantId: TenantId, id: WorkspaceId): Promise<Nullable<Workspace>> {
    const found = this.saved.get(id.value);
    return Promise.resolve(found?.tenantId.equals(tenantId) ? found : null);
  }

  findByIdForUpdate(tenantId: TenantId, id: WorkspaceId): Promise<Nullable<Workspace>> {
    return this.findById(tenantId, id);
  }

  save(workspace: Workspace): Promise<void> {
    this.saved.set(workspace.id.value, workspace);
    return Promise.resolve();
  }
}

export class FakeWorkspaceMembers implements WorkspaceMemberRepository {
  readonly saved = new Map<string, WorkspaceMember>();

  findByUser(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    userId: UserId,
  ): Promise<Nullable<WorkspaceMember>> {
    const found = this.inWorkspace(tenantId, workspaceId).find((member) =>
      member.userId.equals(userId),
    );
    return Promise.resolve(found ?? null);
  }

  countOwners(tenantId: TenantId, workspaceId: WorkspaceId): Promise<number> {
    return this.countWithRole(tenantId, workspaceId, SystemRoleId.OWNER);
  }

  countWithRole(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    roleId: WorkspaceRoleId,
  ): Promise<number> {
    const holders = this.inWorkspace(tenantId, workspaceId).filter((member) =>
      member.roleId.equals(roleId),
    );
    return Promise.resolve(holders.length);
  }

  save(member: WorkspaceMember): Promise<void> {
    this.saved.set(member.id.value, member);
    return Promise.resolve();
  }

  delete(member: WorkspaceMember): Promise<void> {
    this.saved.delete(member.id.value);
    return Promise.resolve();
  }

  inWorkspace(tenantId: TenantId, workspaceId: WorkspaceId): WorkspaceMember[] {
    return [...this.saved.values()].filter(
      (member) => member.tenantId.equals(tenantId) && member.workspaceId.equals(workspaceId),
    );
  }

  roleOf(userId: UserId): Nullable<WorkspaceRoleId> {
    const found = [...this.saved.values()].find((member) => member.userId.equals(userId));
    return found?.roleId ?? null;
  }
}

export class FakeWorkspaceRoles implements WorkspaceRoleRepository, WorkspaceRoleQuery {
  readonly saved = new Map<string, WorkspaceRole>(
    systemRoles().map((role) => [role.id.value, role]),
  );

  constructor(private readonly members: FakeWorkspaceMembers) {}

  findById(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    id: WorkspaceRoleId,
  ): Promise<Nullable<WorkspaceRole>> {
    const found = this.saved.get(id.value);
    return Promise.resolve(found && this.isVisible(found, tenantId, workspaceId) ? found : null);
  }

  save(role: WorkspaceRole): Promise<void> {
    const taken = [...this.saved.values()].some(
      (other) =>
        !other.id.equals(role.id) &&
        other.key === role.key &&
        other.workspaceId?.value === role.workspaceId?.value,
    );
    if (taken) {
      return Promise.reject(new WorkspaceRoleKeyTakenError(role.key));
    }
    this.saved.set(role.id.value, role);
    return Promise.resolve();
  }

  delete(role: WorkspaceRole): Promise<void> {
    this.saved.delete(role.id.value);
    return Promise.resolve();
  }

  async listFor(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    actorId: UserId,
  ): Promise<Nullable<WorkspaceRoleListItem[]>> {
    if (!(await this.members.findByUser(tenantId, workspaceId, actorId))) {
      return null;
    }
    return [...this.saved.values()]
      .filter((role) => this.isVisible(role, tenantId, workspaceId))
      .map((role) => ({
        id: role.id,
        key: role.key,
        name: role.name,
        system: role.isSystem,
        permissions: role.permissions,
      }));
  }

  private isVisible(role: WorkspaceRole, tenantId: TenantId, workspaceId: WorkspaceId): boolean {
    return (
      role.isSystem ||
      (role.tenantId?.equals(tenantId) === true && role.workspaceId?.equals(workspaceId) === true)
    );
  }
}

export class FakeUsers implements UserRepository {
  readonly saved = new Map<string, User>();

  findById(tenantId: TenantId, id: UserId): Promise<Nullable<User>> {
    const found = this.saved.get(id.value);
    return Promise.resolve(found?.tenantId.equals(tenantId) ? found : null);
  }

  findByEmail(email: Email): Promise<Nullable<User>> {
    const found = [...this.saved.values()].find((user) => user.email.equals(email));
    return Promise.resolve(found ?? null);
  }

  save(user: User): Promise<void> {
    const taken = [...this.saved.values()].some(
      (other) => !other.id.equals(user.id) && other.email.equals(user.email),
    );
    if (taken) {
      return Promise.reject(new EmailAlreadyTakenError(user.email.value));
    }
    this.saved.set(user.id.value, user);
    return Promise.resolve();
  }

  delete(tenantId: TenantId, id: UserId): Promise<void> {
    if (this.saved.get(id.value)?.tenantId.equals(tenantId)) {
      this.saved.delete(id.value);
    }
    return Promise.resolve();
  }
}

// INFO: Members keep insertion order, so the newest member is the last one.
function newestFirst(
  members: WorkspaceMember[],
  users: FakeUsers,
  roles: FakeWorkspaceRoles,
): WorkspaceMemberListItem[] {
  return members
    .flatMap((member) => {
      const user = users.saved.get(member.userId.value);
      const role = roles.saved.get(member.roleId.value);
      return user && role
        ? [
            {
              userId: member.userId,
              name: user.name.value,
              email: user.email.value,
              roleId: member.roleId,
              role: role.key,
            },
          ]
        : [];
    })
    .reverse();
}

export class FakeWorkspaceQuery implements WorkspaceQuery {
  constructor(
    private readonly workspaces: FakeWorkspaces,
    private readonly members: FakeWorkspaceMembers,
    private readonly users: FakeUsers,
    private readonly roles: FakeWorkspaceRoles,
  ) {}

  async findDetailFor(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    actorId: UserId,
  ): Promise<Nullable<WorkspaceDetail>> {
    const workspace = await this.workspaces.findById(tenantId, workspaceId);
    const actor = await this.members.findByUser(tenantId, workspaceId, actorId);
    const role = actor && this.roles.saved.get(actor.roleId.value);
    if (!workspace || !actor || !role) {
      return null;
    }
    const members = newestFirst(
      this.members.inWorkspace(tenantId, workspaceId),
      this.users,
      this.roles,
    );
    return {
      id: workspace.id,
      name: workspace.name.value,
      roleId: actor.roleId,
      role: role.key,
      memberCount: members.length,
      members: members.slice(0, WORKSPACE_VIEW_MEMBER_LIMIT),
    };
  }
}

export class FakeWorkspaceMemberQuery implements WorkspaceMemberQuery {
  constructor(
    private readonly members: FakeWorkspaceMembers,
    private readonly users: FakeUsers,
    private readonly roles: FakeWorkspaceRoles,
  ) {}

  async list(params: {
    tenantId: TenantId;
    workspaceId: WorkspaceId;
    actorId: UserId;
    page: number;
    limit: number;
  }): Promise<Nullable<{ items: WorkspaceMemberListItem[]; total: number }>> {
    const { tenantId, workspaceId, actorId } = params;
    if (!(await this.members.findByUser(tenantId, workspaceId, actorId))) {
      return null;
    }
    const members = newestFirst(
      this.members.inWorkspace(tenantId, workspaceId),
      this.users,
      this.roles,
    );
    const start = (params.page - 1) * params.limit;
    return { items: members.slice(start, start + params.limit), total: members.length };
  }
}

export const fakeUnitOfWork: UnitOfWork = { run: (work) => work() };

export function createWorkspaceKit() {
  const workspaces = new FakeWorkspaces();
  const members = new FakeWorkspaceMembers();
  const roles = new FakeWorkspaceRoles(members);
  const access = new WorkspaceAccess(workspaces, members, roles);
  const users = new FakeUsers();
  const tenantId = TenantId.create();
  const clock = new SystemClock();
  const owner = User.create({
    tenantId,
    email: Email.create('owner@acme.co'),
    name: UserName.create('Owner'),
    createdAt: clock.now(),
  });
  const workspace = Workspace.create({
    tenantId,
    name: WorkspaceName.create('Acme'),
    ownerId: owner.id,
    createdAt: clock.now(),
  });
  void users.save(owner);
  void workspaces.save(workspace);
  void members.save(
    WorkspaceMember.create({
      tenantId,
      workspaceId: workspace.id,
      userId: owner.id,
      roleId: SystemRoleId.OWNER,
      createdAt: clock.now(),
    }),
  );

  return {
    workspaces,
    members,
    roles,
    users,
    tenantId,
    owner,
    workspace,
    clock,
    add: new AddWorkspaceMemberHandler(members, access, users, fakeUnitOfWork, clock),
    changeRole: new ChangeWorkspaceMemberRoleHandler(members, access, fakeUnitOfWork, clock),
    remove: new RemoveWorkspaceMemberHandler(members, access, users, fakeUnitOfWork, clock),
    leave: new LeaveWorkspaceHandler(workspaces, members, users, fakeUnitOfWork, clock),
    get: new GetWorkspaceHandler(new FakeWorkspaceQuery(workspaces, members, users, roles)),
    list: new ListWorkspaceMembersHandler(new FakeWorkspaceMemberQuery(members, users, roles)),
    listRoles: new ListWorkspaceRolesHandler(roles),
    createRole: new CreateWorkspaceRoleHandler(roles, access, fakeUnitOfWork, clock),
    updateRole: new UpdateWorkspaceRoleHandler(roles, access, fakeUnitOfWork, clock),
    deleteRole: new DeleteWorkspaceRoleHandler(roles, members, access, fakeUnitOfWork, clock),
  };
}

export type WorkspaceKit = ReturnType<typeof createWorkspaceKit>;
