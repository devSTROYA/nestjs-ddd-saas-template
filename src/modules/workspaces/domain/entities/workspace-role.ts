import { AggregateRoot } from '@common/ddd';
import type { Nullable } from '@common/types';
import type { TenantId } from '@modules/tenants';

import {
  SystemWorkspaceRoleError,
  WorkspaceOwnerRequiredError,
  WorkspacePermissionDeniedError,
} from '../errors/domain.error.js';
import {
  WorkspaceRoleCreatedEvent,
  WorkspaceRoleDeletedEvent,
  WorkspaceRoleUpdatedEvent,
} from '../events/workspace-role.events.js';
import { SystemRoleId } from '../value-objects/system-workspace-role.js';
import type { WorkspaceId } from '../value-objects/workspace-id.js';
import type { WorkspacePermission } from '../value-objects/workspace-permission.js';
import { WorkspaceRoleId } from '../value-objects/workspace-role-id.js';
import type { WorkspaceRoleKey } from '../value-objects/workspace-role-key.js';
import type { WorkspaceRoleName } from '../value-objects/workspace-role-name.js';
import { WorkspacePermissionList } from './workspace-permission-list.js';

// INFO: A role without a workspace is a system role: shared by every workspace and read-only.
type Props = {
  tenantId: Nullable<TenantId>;
  workspaceId: Nullable<WorkspaceId>;
  key: WorkspaceRoleKey;
  name: WorkspaceRoleName;
  permissions: WorkspacePermissionList;
  createdAt: Date;
  updatedAt: Date;
};

type CreateProps = {
  tenantId: TenantId;
  workspaceId: WorkspaceId;
  key: WorkspaceRoleKey;
  name: WorkspaceRoleName;
  permissions: readonly WorkspacePermission[];
  createdAt: Date;
};

export class WorkspaceRole extends AggregateRoot<Props, WorkspaceRoleId> {
  static create(props: CreateProps): WorkspaceRole {
    const id = WorkspaceRoleId.generate();
    // INFO: Starts empty so every permission of a new role shows up as added and gets written.
    const permissions = new WorkspacePermissionList();
    permissions.update(props.permissions);
    const role = new WorkspaceRole({ ...props, permissions, updatedAt: props.createdAt }, id);
    role.addEvent(
      new WorkspaceRoleCreatedEvent({
        aggregateId: id,
        tenantId: props.tenantId,
        occurredAt: props.createdAt.toISOString(),
        workspaceId: props.workspaceId,
        key: props.key.value,
        permissions: permissions.getItems(),
      }),
    );
    return role;
  }

  static rehydrate(props: Props, id: WorkspaceRoleId): WorkspaceRole {
    return new WorkspaceRole(props, id);
  }

  get tenantId(): Nullable<TenantId> {
    return this.props.tenantId;
  }

  get workspaceId(): Nullable<WorkspaceId> {
    return this.props.workspaceId;
  }

  get key(): WorkspaceRoleKey {
    return this.props.key;
  }

  get name(): WorkspaceRoleName {
    return this.props.name;
  }

  get permissions(): readonly WorkspacePermission[] {
    return this.props.permissions.getItems();
  }

  get permissionChanges(): ReturnType<WorkspacePermissionList['getDeltas']> {
    return this.props.permissions.getDeltas();
  }

  get isSystem(): boolean {
    return this.props.workspaceId === null;
  }

  get isOwner(): boolean {
    return this.id === SystemRoleId.OWNER;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  require(permission: WorkspacePermission): void {
    this.assertHolds([permission]);
  }

  assertHolds(permissions: readonly WorkspacePermission[]): void {
    const missing = permissions.filter((permission) => !this.permissions.includes(permission));
    if (missing.length > 0) {
      throw new WorkspacePermissionDeniedError(missing);
    }
  }

  // INFO: Stops escalation: nobody hands out or edits more than they hold, and a custom role with every permission still is not an owner.
  assertCanManage(target: WorkspaceRole): void {
    if (target.isOwner && !this.isOwner) {
      throw new WorkspaceOwnerRequiredError();
    }
    this.assertHolds(target.permissions);
  }

  // INFO: Returns false, raising nothing, when the name and the permissions are already as given.
  update(name: WorkspaceRoleName, permissions: readonly WorkspacePermission[], now: Date): boolean {
    const { tenantId, workspaceId } = this.editableScope();
    const permissionsChanged = this.props.permissions.update(permissions);
    if (name.equals(this.props.name) && !permissionsChanged) {
      return false;
    }
    this.props.name = name;
    this.props.updatedAt = now;
    this.addEvent(
      new WorkspaceRoleUpdatedEvent({
        aggregateId: this.id,
        tenantId: tenantId,
        occurredAt: now.toISOString(),
        workspaceId: workspaceId,
        key: this.props.key.value,
        permissions: this.props.permissions.getItems(),
      }),
    );
    return true;
  }

  remove(now: Date): void {
    const { tenantId, workspaceId } = this.editableScope();
    this.addEvent(
      new WorkspaceRoleDeletedEvent({
        aggregateId: this.id,
        tenantId: tenantId,
        occurredAt: now.toISOString(),
        workspaceId: workspaceId,
        key: this.props.key.value,
      }),
    );
  }

  private editableScope(): { tenantId: TenantId; workspaceId: WorkspaceId } {
    const { tenantId, workspaceId, key } = this.props;
    if (!tenantId || !workspaceId) {
      throw new SystemWorkspaceRoleError(key.value);
    }
    return { tenantId, workspaceId };
  }
}
