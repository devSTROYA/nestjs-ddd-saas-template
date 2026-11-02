import { AggregateRoot } from '@common/ddd';
import type { TenantId } from '@modules/tenants';
import type { UserId } from '@modules/users';

import { LastWorkspaceOwnerRequiredError } from '../errors/domain.error.js';
import {
  WorkspaceMemberAddedEvent,
  WorkspaceMemberRemovedEvent,
  WorkspaceMemberRoleChangedEvent,
} from '../events/workspace-member.events.js';
import type { WorkspaceId } from '../value-objects/workspace-id.js';
import { WorkspaceMemberId } from '../value-objects/workspace-member-id.js';
import { WorkspaceRole } from '../value-objects/workspace-role.js';

type Props = {
  tenantId: TenantId;
  workspaceId: WorkspaceId;
  userId: UserId;
  role: WorkspaceRole;
  createdAt: Date;
  updatedAt: Date;
};

type CreateProps = Omit<Props, 'updatedAt'>;

export class WorkspaceMember extends AggregateRoot<Props, WorkspaceMemberId> {
  static create(props: CreateProps): WorkspaceMember {
    const id = WorkspaceMemberId.create();
    const member = new WorkspaceMember({ ...props, updatedAt: props.createdAt }, id);
    member.addEvent(
      new WorkspaceMemberAddedEvent({
        aggregateId: id.value,
        tenantId: props.tenantId.value,
        occurredAt: props.createdAt.toISOString(),
        workspaceId: props.workspaceId.value,
        userId: props.userId.value,
        role: props.role,
      }),
    );
    return member;
  }

  static restore(props: Props, id: WorkspaceMemberId): WorkspaceMember {
    return new WorkspaceMember(props, id);
  }

  get tenantId(): TenantId {
    return this.props.tenantId;
  }

  get workspaceId(): WorkspaceId {
    return this.props.workspaceId;
  }

  get userId(): UserId {
    return this.props.userId;
  }

  get role(): WorkspaceRole {
    return this.props.role;
  }

  get isOwner(): boolean {
    return this.props.role === WorkspaceRole.OWNER;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // INFO: ownerCount counts this workspace's owners, read while holding the workspace lock.
  changeRole(role: WorkspaceRole, ownerCount: number, now: Date): void {
    if (role !== WorkspaceRole.OWNER) {
      this.assertNotLastOwner(ownerCount);
    }
    const previousRole = this.props.role;
    this.props.role = role;
    this.props.updatedAt = now;
    this.addEvent(
      new WorkspaceMemberRoleChangedEvent({
        aggregateId: this.id.value,
        tenantId: this.props.tenantId.value,
        occurredAt: now.toISOString(),
        workspaceId: this.props.workspaceId.value,
        userId: this.props.userId.value,
        previousRole,
        role,
      }),
    );
  }

  // INFO: ownerCount counts this workspace's owners, read while holding the workspace lock.
  remove(ownerCount: number, now: Date): void {
    this.assertNotLastOwner(ownerCount);
    this.addEvent(
      new WorkspaceMemberRemovedEvent({
        aggregateId: this.id.value,
        tenantId: this.props.tenantId.value,
        occurredAt: now.toISOString(),
        workspaceId: this.props.workspaceId.value,
        userId: this.props.userId.value,
      }),
    );
  }

  private assertNotLastOwner(ownerCount: number): void {
    if (this.isOwner && ownerCount <= 1) {
      throw new LastWorkspaceOwnerRequiredError();
    }
  }
}
