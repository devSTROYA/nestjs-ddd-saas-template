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

type WorkspaceProps = {
  tenantId: TenantId;
  name: WorkspaceName;
  roles: Map<UserId, WorkspaceRole>;
  createdAt: Date;
};

export class Workspace extends AggregateRoot<WorkspaceProps, WorkspaceId> {
  static create(props: {
    id: WorkspaceId;
    tenantId: TenantId;
    name: WorkspaceName;
    ownerId: UserId;
  }): Workspace {
    const now = new Date();
    const workspace = new Workspace(
      {
        tenantId: props.tenantId,
        name: props.name,
        roles: new Map([[props.ownerId, WorkspaceRole.OWNER]]),
        createdAt: now,
      },
      props.id,
    );
    workspace.addEvent(
      new WorkspaceCreatedEvent(
        props.id,
        props.tenantId,
        now.toISOString(),
        props.ownerId,
        props.name.value,
      ),
    );
    return workspace;
  }

  static restore(props: {
    id: WorkspaceId;
    tenantId: TenantId;
    name: WorkspaceName;
    members: readonly WorkspaceMember[];
    createdAt: Date;
  }): Workspace {
    return new Workspace(
      {
        tenantId: props.tenantId,
        name: props.name,
        roles: new Map(props.members.map((member) => [member.userId, member.role])),
        createdAt: props.createdAt,
      },
      props.id,
    );
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

  get members(): WorkspaceMember[] {
    return [...this.props.roles].map(([userId, role]) => ({ userId, role }));
  }

  roleOf(userId: UserId): Nullable<WorkspaceRole> {
    return this.props.roles.get(userId) ?? null;
  }

  rename(name: WorkspaceName): void {
    this.props.name = name;
    this.addEvent(
      new WorkspaceRenamedEvent(this.id, this.props.tenantId, new Date().toISOString(), name.value),
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
    this.addEvent(
      new WorkspaceMemberAddedEvent(
        this.id,
        this.props.tenantId,
        new Date().toISOString(),
        userId,
        role,
      ),
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
    this.addEvent(
      new WorkspaceMemberRoleChangedEvent(
        this.id,
        this.props.tenantId,
        new Date().toISOString(),
        userId,
        current,
        role,
      ),
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
    this.addEvent(
      new WorkspaceMemberRemovedEvent(
        this.id,
        this.props.tenantId,
        new Date().toISOString(),
        userId,
      ),
    );
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
