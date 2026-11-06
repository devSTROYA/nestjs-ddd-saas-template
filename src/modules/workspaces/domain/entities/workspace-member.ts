import { AggregateRoot } from '@common/ddd';
import type { TenantId } from '@modules/tenants';
import type { UserId } from '@modules/users';

import { LastWorkspaceOwnerRequiredError } from '../errors/domain.error.js';
import {
  WorkspaceMemberAddedEvent,
  WorkspaceMemberRemovedEvent,
  WorkspaceMemberRoleChangedEvent,
} from '../events/workspace-member.events.js';
import { SystemRoleId } from '../value-objects/system-workspace-role.js';
import type { WorkspaceId } from '../value-objects/workspace-id.js';
import { WorkspaceMemberId } from '../value-objects/workspace-member-id.js';
import type { WorkspaceRoleId } from '../value-objects/workspace-role-id.js';

type Props = {
  tenantId: TenantId;
  workspaceId: WorkspaceId;
  userId: UserId;
  roleId: WorkspaceRoleId;
  createdAt: Date;
  updatedAt: Date;
};

type CreateProps = Omit<Props, 'updatedAt'>;

export class WorkspaceMember extends AggregateRoot<Props, WorkspaceMemberId> {
  static create(props: CreateProps): WorkspaceMember {
    const id = WorkspaceMemberId.generate();
    const member = new WorkspaceMember({ ...props, updatedAt: props.createdAt }, id);
    member.addEvent(
      new WorkspaceMemberAddedEvent({
        aggregateId: id,
        tenantId: props.tenantId,
        occurredAt: props.createdAt.toISOString(),
        workspaceId: props.workspaceId,
        userId: props.userId,
        roleId: props.roleId,
      }),
    );
    return member;
  }

  static rehydrate(props: Props, id: WorkspaceMemberId): WorkspaceMember {
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

  get roleId(): WorkspaceRoleId {
    return this.props.roleId;
  }

  get isOwner(): boolean {
    return this.props.roleId === SystemRoleId.OWNER;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // INFO: ownerCount counts this workspace's owners, read while holding the workspace lock. Returns false when the member already holds the role.
  changeRole(roleId: WorkspaceRoleId, ownerCount: number, now: Date): boolean {
    if (roleId === this.props.roleId) {
      return false;
    }
    if (roleId !== SystemRoleId.OWNER) {
      this.assertNotLastOwner(ownerCount);
    }
    const previousRoleId = this.props.roleId;
    this.props.roleId = roleId;
    this.props.updatedAt = now;
    this.addEvent(
      new WorkspaceMemberRoleChangedEvent({
        aggregateId: this.id,
        tenantId: this.props.tenantId,
        occurredAt: now.toISOString(),
        workspaceId: this.props.workspaceId,
        userId: this.props.userId,
        previousRoleId: previousRoleId,
        roleId: roleId,
      }),
    );
    return true;
  }

  // INFO: ownerCount counts this workspace's owners, read while holding the workspace lock.
  remove(ownerCount: number, now: Date): void {
    this.assertNotLastOwner(ownerCount);
    this.addEvent(
      new WorkspaceMemberRemovedEvent({
        aggregateId: this.id,
        tenantId: this.props.tenantId,
        occurredAt: now.toISOString(),
        workspaceId: this.props.workspaceId,
        userId: this.props.userId,
      }),
    );
  }

  private assertNotLastOwner(ownerCount: number): void {
    if (this.isOwner && ownerCount <= 1) {
      throw new LastWorkspaceOwnerRequiredError();
    }
  }
}
