import type { UnitOfWork } from '@common/database';
import { Email } from '@common/primitives';
import type { Nullable } from '@common/types';
import { type TenantId, newTenantId } from '@modules/tenants';
import {
  EmailAlreadyTakenError,
  User,
  UserName,
  type UserId,
  type UserRepository,
  newUserId,
} from '@modules/users';

import type { WorkspaceRepository } from '../application/ports/workspace.repository.js';
import { AddWorkspaceMemberHandler } from '../application/use-cases/add-workspace-member/add-workspace-member.handler.js';
import { ChangeWorkspaceMemberRoleHandler } from '../application/use-cases/change-workspace-member-role/change-workspace-member-role.handler.js';
import { GetWorkspaceHandler } from '../application/use-cases/get-workspace/get-workspace.handler.js';
import { LeaveWorkspaceHandler } from '../application/use-cases/leave-workspace/leave-workspace.handler.js';
import { RemoveWorkspaceMemberHandler } from '../application/use-cases/remove-workspace-member/remove-workspace-member.handler.js';
import { Workspace } from '../domain/entities/workspace.js';
import { newWorkspaceId } from '../domain/value-objects/workspace-id.js';
import { WorkspaceName } from '../domain/value-objects/workspace-name.js';

export class FakeWorkspaces implements WorkspaceRepository {
  readonly saved = new Map<string, Workspace>();

  findByTenantId(tenantId: TenantId): Promise<Nullable<Workspace>> {
    const found = [...this.saved.values()].find((workspace) => workspace.tenantId === tenantId);
    return Promise.resolve(found ?? null);
  }

  findByTenantIdForUpdate(tenantId: TenantId): Promise<Nullable<Workspace>> {
    return this.findByTenantId(tenantId);
  }

  save(workspace: Workspace): Promise<void> {
    this.saved.set(workspace.id, workspace);
    return Promise.resolve();
  }
}

export class FakeUsers implements UserRepository {
  readonly saved = new Map<string, User>();

  findById(tenantId: TenantId, id: UserId): Promise<Nullable<User>> {
    const found = this.saved.get(id);
    return Promise.resolve(found?.tenantId === tenantId ? found : null);
  }

  findByEmail(email: Email): Promise<Nullable<User>> {
    const found = [...this.saved.values()].find((user) => user.email.equals(email));
    return Promise.resolve(found ?? null);
  }

  // Like the real repository: emails are unique across all tenants.
  save(user: User): Promise<void> {
    const taken = [...this.saved.values()].some(
      (other) => other.id !== user.id && other.email.equals(user.email),
    );
    if (taken) {
      return Promise.reject(new EmailAlreadyTakenError(user.email.value));
    }
    this.saved.set(user.id, user);
    return Promise.resolve();
  }

  delete(tenantId: TenantId, id: UserId): Promise<void> {
    if (this.saved.get(id)?.tenantId === tenantId) {
      this.saved.delete(id);
    }
    return Promise.resolve();
  }
}

export const fakeUnitOfWork: UnitOfWork = { run: (work) => work() };

export function createWorkspaceKit() {
  const workspaces = new FakeWorkspaces();
  const users = new FakeUsers();
  const tenantId = newTenantId();
  const owner = User.create({
    id: newUserId(),
    tenantId,
    email: Email.create('owner@acme.co'),
    name: UserName.create('Owner'),
  });
  const workspace = Workspace.create({
    id: newWorkspaceId(),
    tenantId,
    name: WorkspaceName.create('Acme'),
    ownerId: owner.id,
  });
  void users.save(owner);
  void workspaces.save(workspace);

  return {
    workspaces,
    users,
    tenantId,
    owner,
    workspace,
    add: new AddWorkspaceMemberHandler(workspaces, users, fakeUnitOfWork),
    changeRole: new ChangeWorkspaceMemberRoleHandler(workspaces, fakeUnitOfWork),
    remove: new RemoveWorkspaceMemberHandler(workspaces, users, fakeUnitOfWork),
    leave: new LeaveWorkspaceHandler(workspaces, users, fakeUnitOfWork),
    get: new GetWorkspaceHandler(workspaces),
  };
}

export type WorkspaceKit = ReturnType<typeof createWorkspaceKit>;
