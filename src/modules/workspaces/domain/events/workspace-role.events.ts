import { DomainEvent, type DomainEventProps } from '@common/ddd';

export const WorkspaceRoleEventNames = {
  CREATED: 'workspace.role_created',
  UPDATED: 'workspace.role_updated',
  DELETED: 'workspace.role_deleted',
} as const;

type WorkspaceRoleEventProps = Omit<DomainEventProps, 'tenantId'> & {
  tenantId: string;
  workspaceId: string;
  key: string;
};

type WithPermissions = WorkspaceRoleEventProps & { permissions: readonly string[] };

export class WorkspaceRoleCreatedEvent extends DomainEvent {
  readonly name = WorkspaceRoleEventNames.CREATED;
  readonly workspaceId: string;
  readonly key: string;
  readonly permissions: readonly string[];

  constructor(props: WithPermissions) {
    super(props);
    this.workspaceId = props.workspaceId;
    this.key = props.key;
    this.permissions = props.permissions;
  }
}

export class WorkspaceRoleUpdatedEvent extends DomainEvent {
  readonly name = WorkspaceRoleEventNames.UPDATED;
  readonly workspaceId: string;
  readonly key: string;
  readonly permissions: readonly string[];

  constructor(props: WithPermissions) {
    super(props);
    this.workspaceId = props.workspaceId;
    this.key = props.key;
    this.permissions = props.permissions;
  }
}

export class WorkspaceRoleDeletedEvent extends DomainEvent {
  readonly name = WorkspaceRoleEventNames.DELETED;
  readonly workspaceId: string;
  readonly key: string;

  constructor(props: WorkspaceRoleEventProps) {
    super(props);
    this.workspaceId = props.workspaceId;
    this.key = props.key;
  }
}
