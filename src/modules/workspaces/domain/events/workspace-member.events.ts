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
  readonly role: string;

  constructor(props: WorkspaceMemberEventProps & { role: string }) {
    super(props);
    this.workspaceId = props.workspaceId;
    this.userId = props.userId;
    this.role = props.role;
  }
}

export class WorkspaceMemberRoleChangedEvent extends DomainEvent {
  readonly name = WorkspaceMemberEventNames.ROLE_CHANGED;
  readonly workspaceId: string;
  readonly userId: string;
  readonly previousRole: string;
  readonly role: string;

  constructor(props: WorkspaceMemberEventProps & { previousRole: string; role: string }) {
    super(props);
    this.workspaceId = props.workspaceId;
    this.userId = props.userId;
    this.previousRole = props.previousRole;
    this.role = props.role;
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
