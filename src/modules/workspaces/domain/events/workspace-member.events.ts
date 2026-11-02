import { DomainEvent, type DomainEventProps } from '@common/ddd';

export const WorkspaceMemberEventNames = {
  ADDED: 'workspace.member_added',
  ROLE_CHANGED: 'workspace.member_role_changed',
  REMOVED: 'workspace.member_removed',
} as const;

type WorkspaceMemberEventProps = Omit<DomainEventProps, 'tenantId'> & {
  tenantId: string;
  workspaceId: string;
  userId: string;
};

export class WorkspaceMemberAddedEvent extends DomainEvent {
  readonly name = WorkspaceMemberEventNames.ADDED;
  readonly workspaceId: string;
  readonly userId: string;
  readonly roleId: string;

  constructor(props: WorkspaceMemberEventProps & { roleId: string }) {
    super(props);
    this.workspaceId = props.workspaceId;
    this.userId = props.userId;
    this.roleId = props.roleId;
  }
}

export class WorkspaceMemberRoleChangedEvent extends DomainEvent {
  readonly name = WorkspaceMemberEventNames.ROLE_CHANGED;
  readonly workspaceId: string;
  readonly userId: string;
  readonly previousRoleId: string;
  readonly roleId: string;

  constructor(props: WorkspaceMemberEventProps & { previousRoleId: string; roleId: string }) {
    super(props);
    this.workspaceId = props.workspaceId;
    this.userId = props.userId;
    this.previousRoleId = props.previousRoleId;
    this.roleId = props.roleId;
  }
}

export class WorkspaceMemberRemovedEvent extends DomainEvent {
  readonly name = WorkspaceMemberEventNames.REMOVED;
  readonly workspaceId: string;
  readonly userId: string;

  constructor(props: WorkspaceMemberEventProps) {
    super(props);
    this.workspaceId = props.workspaceId;
    this.userId = props.userId;
  }
}
