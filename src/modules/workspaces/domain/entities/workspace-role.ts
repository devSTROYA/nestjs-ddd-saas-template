import { AggregateRoot } from '@common/ddd';
import type { Nullable } from '@common/types';
import type { TenantId } from '@modules/tenants';

import {
  SystemWorkspaceRoleError,
  WorkspaceOwnerRequiredError,
  WorkspacePermissionDeniedError,
  WorkspaceRoleKeyInvalidError,
  WorkspaceRoleKeyTakenError,
  WorkspaceRoleNameInvalidError,
} from '../errors/domain.error.js';
import {
  WorkspaceRoleCreatedEvent,
  WorkspaceRoleDeletedEvent,
  WorkspaceRoleUpdatedEvent,
} from '../events/workspace-role.events.js';
import { SYSTEM_ROLE_KEYS, SystemRoleId } from '../value-objects/system-workspace-role.js';
import type { WorkspaceId } from '../value-objects/workspace-id.js';
import type { WorkspacePermission } from '../value-objects/workspace-permission.js';
import { WorkspaceRoleId } from '../value-objects/workspace-role-id.js';
import { WorkspacePermissionList } from './workspace-permission-list.js';

const MAX_WORKSPACE_ROLE_KEY_LENGTH = 32;
const MAX_WORKSPACE_ROLE_NAME_LENGTH = 64;
const ROLE_KEY_PATTERN = /^[a-z][a-z0-9-]*$/;

// INFO: A role without a workspace is a system role: shared by every workspace and read-only.
type Props = {
  tenantId: Nullable<TenantId>;
  workspaceId: Nullable<WorkspaceId>;
  key: string;
  name: string;
  permissions: WorkspacePermissionList;
  createdAt: Date;
  updatedAt: Date;
};

type CreateProps = {
  tenantId: TenantId;
  workspaceId: WorkspaceId;
  key: string;
  name: string;
  permissions: readonly WorkspacePermission[];
  createdAt: Date;
};

function normalizedName(raw: string): string {
  const name = raw.trim();
  if (!name || name.length > MAX_WORKSPACE_ROLE_NAME_LENGTH) {
    throw new WorkspaceRoleNameInvalidError(MAX_WORKSPACE_ROLE_NAME_LENGTH);
  }
  return name;
}

function assertUsableKey(key: string): void {
  if (key.length > MAX_WORKSPACE_ROLE_KEY_LENGTH || !ROLE_KEY_PATTERN.test(key)) {
    throw new WorkspaceRoleKeyInvalidError(MAX_WORKSPACE_ROLE_KEY_LENGTH);
  }
  if (SYSTEM_ROLE_KEYS.includes(key)) {
    throw new WorkspaceRoleKeyTakenError(key);
  }
}

export class WorkspaceRole extends AggregateRoot<Props, WorkspaceRoleId> {
  static create(props: CreateProps): WorkspaceRole {
    assertUsableKey(props.key);
    const id = WorkspaceRoleId.create();
    // INFO: Starts empty so every permission of a new role shows up as added and gets written.
    const permissions = new WorkspacePermissionList();
    permissions.update(props.permissions);
    const role = new WorkspaceRole(
      { ...props, name: normalizedName(props.name), permissions, updatedAt: props.createdAt },
      id,
    );
    role.addEvent(
      new WorkspaceRoleCreatedEvent({
        aggregateId: id.value,
        tenantId: props.tenantId.value,
        occurredAt: props.createdAt.toISOString(),
        workspaceId: props.workspaceId.value,
        key: props.key,
        permissions: permissions.getItems(),
      }),
    );
    return role;
  }

  static restore(props: Props, id: WorkspaceRoleId): WorkspaceRole {
    return new WorkspaceRole(props, id);
  }

  get tenantId(): Nullable<TenantId> {
    return this.props.tenantId;
  }

  get workspaceId(): Nullable<WorkspaceId> {
    return this.props.workspaceId;
  }

  get key(): string {
    return this.props.key;
  }

  get name(): string {
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
    return this.id.equals(SystemRoleId.OWNER);
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

  update(name: string, permissions: readonly WorkspacePermission[], now: Date): void {
    const { tenantId, workspaceId } = this.editableScope();
    this.props.name = normalizedName(name);
    this.props.permissions.update(permissions);
    this.props.updatedAt = now;
    this.addEvent(
      new WorkspaceRoleUpdatedEvent({
        aggregateId: this.id.value,
        tenantId: tenantId.value,
        occurredAt: now.toISOString(),
        workspaceId: workspaceId.value,
        key: this.props.key,
        permissions: this.props.permissions.getItems(),
      }),
    );
  }

  remove(now: Date): void {
    const { tenantId, workspaceId } = this.editableScope();
    this.addEvent(
      new WorkspaceRoleDeletedEvent({
        aggregateId: this.id.value,
        tenantId: tenantId.value,
        occurredAt: now.toISOString(),
        workspaceId: workspaceId.value,
        key: this.props.key,
      }),
    );
  }

  private editableScope(): { tenantId: TenantId; workspaceId: WorkspaceId } {
    const { tenantId, workspaceId, key } = this.props;
    if (!tenantId || !workspaceId) {
      throw new SystemWorkspaceRoleError(key);
    }
    return { tenantId, workspaceId };
  }
}
