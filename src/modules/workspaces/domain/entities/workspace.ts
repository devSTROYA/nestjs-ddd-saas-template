import { AggregateRoot } from '@common/ddd';
import type { Nullable } from '@common/types';
import type { TenantId } from '@modules/tenants';
import type { UserId } from '@modules/users';

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
import type { WorkspaceId } from '../value-objects/workspace-id.js';
import type { WorkspaceName } from '../value-objects/workspace-name.js';
import { WorkspaceRole } from '../value-objects/workspace-role.js';

export type WorkspaceMember = {
  userId: UserId;
  role: WorkspaceRole;
};

type Props = {
  tenantId: TenantId;
  name: WorkspaceName;
  roles: Map<UserId, WorkspaceRole>;
  createdAt: Date;
  updatedAt: Date;
};

type CreateProps = {
  tenantId: TenantId;
  name: WorkspaceName;
  ownerId: UserId;
};

export class Workspace extends AggregateRoot<Props, WorkspaceId> {
  static create(props: CreateProps, id: WorkspaceId): Workspace {
    const now = new Date();
    const workspace = new Workspace(
      {
        tenantId: props.tenantId,
        name: props.name,
        roles: new Map([[props.ownerId, WorkspaceRole.OWNER]]),
        createdAt: now,
        updatedAt: now,
      },
      id,
    );
    workspace.addEvent(
      new WorkspaceCreatedEvent({
        aggregateId: id,
        tenantId: props.tenantId,
        occurredAt: now.toISOString(),
        ownerId: props.ownerId,
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
    return [...this.props.roles].map(([userId, role]) => ({ userId, role }));
  }

  roleOf(userId: UserId): Nullable<WorkspaceRole> {
    return this.props.roles.get(userId) ?? null;
  }

  rename(name: WorkspaceName): void {
    this.props.name = name;
    const now = this.touch();
    this.addEvent(
      new WorkspaceRenamedEvent({
        aggregateId: this.id,
        tenantId: this.props.tenantId,
        occurredAt: now.toISOString(),
        workspaceName: name.value,
      }),
    );
  }

  assertOwner(userId: UserId): void {
    if (this.props.roles.get(userId) !== WorkspaceRole.OWNER) {
      throw new WorkspaceOwnerRequiredError();
    }
  }

  addMember(userId: UserId, role: WorkspaceRole): void {
    if (this.props.roles.has(userId)) {
      throw new WorkspaceMemberAlreadyExistsError(userId);
    }
    this.props.roles.set(userId, role);
    const now = this.touch();
    this.addEvent(
      new WorkspaceMemberAddedEvent({
        aggregateId: this.id,
        tenantId: this.props.tenantId,
        occurredAt: now.toISOString(),
        userId,
        role,
      }),
    );
  }

  changeRole(userId: UserId, role: WorkspaceRole): void {
    const current = this.props.roles.get(userId);
    if (current === undefined) {
      throw new WorkspaceMemberNotFoundError(userId);
    }
    if (current === WorkspaceRole.OWNER && role !== WorkspaceRole.OWNER) {
      this.assertAnotherOwnerExists(userId);
    }
    this.props.roles.set(userId, role);
    const now = this.touch();
    this.addEvent(
      new WorkspaceMemberRoleChangedEvent({
        aggregateId: this.id,
        tenantId: this.props.tenantId,
        occurredAt: now.toISOString(),
        userId,
        previousRole: current,
        role,
      }),
    );
  }

  removeMember(userId: UserId): void {
    const current = this.props.roles.get(userId);
    if (current === undefined) {
      throw new WorkspaceMemberNotFoundError(userId);
    }
    if (current === WorkspaceRole.OWNER) {
      this.assertAnotherOwnerExists(userId);
    }
    this.props.roles.delete(userId);
    const now = this.touch();
    this.addEvent(
      new WorkspaceMemberRemovedEvent({
        aggregateId: this.id,
        tenantId: this.props.tenantId,
        occurredAt: now.toISOString(),
        userId,
      }),
    );
  }

  private touch(): Date {
    const now = new Date();
    this.props.updatedAt = now;
    return now;
  }

  private assertAnotherOwnerExists(except: UserId): void {
    const hasAnotherOwner = [...this.props.roles].some(
      ([userId, role]) => userId !== except && role === WorkspaceRole.OWNER,
    );
    if (!hasAnotherOwner) {
      throw new LastWorkspaceOwnerRequiredError();
    }
  }
}
