import { AggregateRoot } from '@common/ddd';
import type { Nullable } from '@common/types';
import type { TenantId } from '@modules/tenants';
import { UserId } from '@modules/users';

import {
  LastWorkspaceOwnerRequiredError,
  WorkspaceMemberAlreadyExistsError,
  WorkspaceMemberNotFoundError,
  WorkspaceOwnerRequiredError,
} from '../errors/domain.error.js';
import {
  WorkspaceCreatedEvent,
  WorkspaceMemberAddedEvent,
  WorkspaceMemberRemovedEvent,
  WorkspaceMemberRoleChangedEvent,
  WorkspaceRenamedEvent,
} from '../events/workspace.events.js';
import { WorkspaceId } from '../value-objects/workspace-id.js';
import type { WorkspaceName } from '../value-objects/workspace-name.js';
import { WorkspaceRole } from '../value-objects/workspace-role.js';

type WorkspaceMember = {
  userId: UserId;
  role: WorkspaceRole;
};

type Props = {
  tenantId: TenantId;
  name: WorkspaceName;
  roles: Map<string, WorkspaceRole>;
  createdAt: Date;
  updatedAt: Date;
};

type CreateProps = {
  tenantId: TenantId;
  name: WorkspaceName;
  ownerId: UserId;
  createdAt: Date;
};

export class Workspace extends AggregateRoot<Props, WorkspaceId> {
  static create(props: CreateProps): Workspace {
    const id = WorkspaceId.create();
    const workspace = new Workspace(
      {
        tenantId: props.tenantId,
        name: props.name,
        roles: new Map([[props.ownerId.value, WorkspaceRole.OWNER]]),
        createdAt: props.createdAt,
        updatedAt: props.createdAt,
      },
      id,
    );
    workspace.addEvent(
      new WorkspaceCreatedEvent({
        aggregateId: id.value,
        tenantId: props.tenantId.value,
        occurredAt: props.createdAt.toISOString(),
        ownerId: props.ownerId.value,
        workspaceName: props.name.value,
      }),
    );
    return workspace;
  }

  static restore(props: Props, id: WorkspaceId): Workspace {
    return new Workspace(props, id);
  }

  get tenantId(): TenantId {
    return this.props.tenantId;
  }

  get name(): WorkspaceName {
    return this.props.name;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get members(): WorkspaceMember[] {
    return [...this.props.roles].map(([userId, role]) => ({
      userId: UserId.restore(userId),
      role,
    }));
  }

  roleOf(userId: UserId): Nullable<WorkspaceRole> {
    return this.props.roles.get(userId.value) ?? null;
  }

  rename(name: WorkspaceName, now: Date): void {
    this.props.name = name;
    this.props.updatedAt = now;
    this.addEvent(
      new WorkspaceRenamedEvent({
        aggregateId: this.id.value,
        tenantId: this.props.tenantId.value,
        occurredAt: now.toISOString(),
        workspaceName: name.value,
      }),
    );
  }

  assertOwner(userId: UserId): void {
    if (this.props.roles.get(userId.value) !== WorkspaceRole.OWNER) {
      throw new WorkspaceOwnerRequiredError();
    }
  }

  addMember(userId: UserId, role: WorkspaceRole, now: Date): void {
    if (this.props.roles.has(userId.value)) {
      throw new WorkspaceMemberAlreadyExistsError(userId.value);
    }
    this.props.roles.set(userId.value, role);
    this.props.updatedAt = now;
    this.addEvent(
      new WorkspaceMemberAddedEvent({
        aggregateId: this.id.value,
        tenantId: this.props.tenantId.value,
        occurredAt: now.toISOString(),
        userId: userId.value,
        role,
      }),
    );
  }

  changeRole(userId: UserId, role: WorkspaceRole, now: Date): void {
    const current = this.props.roles.get(userId.value);
    if (current === undefined) {
      throw new WorkspaceMemberNotFoundError(userId.value);
    }
    if (current === WorkspaceRole.OWNER && role !== WorkspaceRole.OWNER) {
      this.assertAnotherOwnerExists(userId);
    }
    this.props.roles.set(userId.value, role);
    this.props.updatedAt = now;
    this.addEvent(
      new WorkspaceMemberRoleChangedEvent({
        aggregateId: this.id.value,
        tenantId: this.props.tenantId.value,
        occurredAt: now.toISOString(),
        userId: userId.value,
        previousRole: current,
        role,
      }),
    );
  }

  removeMember(userId: UserId, now: Date): void {
    const current = this.props.roles.get(userId.value);
    if (current === undefined) {
      throw new WorkspaceMemberNotFoundError(userId.value);
    }
    if (current === WorkspaceRole.OWNER) {
      this.assertAnotherOwnerExists(userId);
    }
    this.props.roles.delete(userId.value);
    this.props.updatedAt = now;
    this.addEvent(
      new WorkspaceMemberRemovedEvent({
        aggregateId: this.id.value,
        tenantId: this.props.tenantId.value,
        occurredAt: now.toISOString(),
        userId: userId.value,
      }),
    );
  }

  private assertAnotherOwnerExists(except: UserId): void {
    const hasAnotherOwner = [...this.props.roles].some(
      ([userId, role]) => userId !== except.value && role === WorkspaceRole.OWNER,
    );
    if (!hasAnotherOwner) {
      throw new LastWorkspaceOwnerRequiredError();
    }
  }
}
