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

import {
  WORKSPACE_VIEW_MEMBER_LIMIT,
  type WorkspaceMemberView,
  type WorkspaceQuery,
  type WorkspaceView,
} from '../application/ports/workspace.query.js';
import type { WorkspaceRepository } from '../application/ports/workspace.repository.js';
import { AddWorkspaceMemberHandler } from '../application/use-cases/add-workspace-member/add-workspace-member.handler.js';
import { ChangeWorkspaceMemberRoleHandler } from '../application/use-cases/change-workspace-member-role/change-workspace-member-role.handler.js';
import { GetWorkspaceHandler } from '../application/use-cases/get-workspace/get-workspace.handler.js';
import { LeaveWorkspaceHandler } from '../application/use-cases/leave-workspace/leave-workspace.handler.js';
import { ListWorkspaceMembersHandler } from '../application/use-cases/list-workspace-members/list-workspace-members.handler.js';
import { RemoveWorkspaceMemberHandler } from '../application/use-cases/remove-workspace-member/remove-workspace-member.handler.js';
import { Workspace } from '../domain/entities/workspace.js';
import { WorkspaceId } from '../domain/value-objects/workspace-id.js';
import { WorkspaceName } from '../domain/value-objects/workspace-name.js';

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

export class FakeWorkspaceQuery implements WorkspaceQuery {
  constructor(
    private readonly workspaces: FakeWorkspaces,
    private readonly users: FakeUsers,
  ) {}

  async findViewFor(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    actorId: UserId,
  ): Promise<Nullable<WorkspaceView>> {
    const workspace = await this.workspaces.findById(tenantId, workspaceId);
    const role = workspace?.roleOf(actorId);
    if (!workspace || !role) {
      return null;
    }
    const members = this.newestFirst(workspace);
    return {
      id: workspace.id,
      name: workspace.name.value,
      role,
      memberCount: members.length,
      members: members.slice(0, WORKSPACE_VIEW_MEMBER_LIMIT),
    };
  }

  async listMembers(params: {
    tenantId: TenantId;
    workspaceId: WorkspaceId;
    actorId: UserId;
    page: number;
    limit: number;
  }): Promise<Nullable<{ items: WorkspaceMemberView[]; total: number }>> {
    const workspace = await this.workspaces.findById(params.tenantId, params.workspaceId);
    if (!workspace?.roleOf(params.actorId)) {
      return null;
    }
    const members = this.newestFirst(workspace);
    const start = (params.page - 1) * params.limit;
    return { items: members.slice(start, start + params.limit), total: members.length };
  }

  // INFO: Members keep insertion order, so the newest member is the last one.
  private newestFirst(workspace: Workspace): WorkspaceMemberView[] {
    return workspace.members
      .flatMap((member) => {
        const user = this.users.saved.get(member.userId.value);
        return user
          ? [
              {
                userId: member.userId,
                name: user.name.value,
                email: user.email.value,
                role: member.role,
              },
            ]
          : [];
      })
      .reverse();
  }
}

export const fakeUnitOfWork: UnitOfWork = { run: (work) => work() };

export function createWorkspaceKit() {
  const workspaces = new FakeWorkspaces();
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

  return {
    workspaces,
    users,
    tenantId,
    owner,
    workspace,
    clock,
    add: new AddWorkspaceMemberHandler(workspaces, users, fakeUnitOfWork, clock),
    changeRole: new ChangeWorkspaceMemberRoleHandler(workspaces, fakeUnitOfWork, clock),
    remove: new RemoveWorkspaceMemberHandler(workspaces, users, fakeUnitOfWork, clock),
    leave: new LeaveWorkspaceHandler(workspaces, users, fakeUnitOfWork, clock),
    get: new GetWorkspaceHandler(new FakeWorkspaceQuery(workspaces, users)),
    list: new ListWorkspaceMembersHandler(new FakeWorkspaceQuery(workspaces, users)),
  };
}

export type WorkspaceKit = ReturnType<typeof createWorkspaceKit>;
