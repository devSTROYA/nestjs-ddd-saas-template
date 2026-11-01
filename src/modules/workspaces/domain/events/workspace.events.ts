import { DomainEvent, type DomainEventProps } from '@common/ddd';

export const WorkspaceEventNames = {
  CREATED: 'workspace.created',
  RENAMED: 'workspace.renamed',
  MEMBER_ADDED: 'workspace.member_added',
  MEMBER_ROLE_CHANGED: 'workspace.member_role_changed',
  MEMBER_REMOVED: 'workspace.member_removed',
} as const;

type WorkspaceEventProps = Omit<DomainEventProps, 'tenantId'> & { tenantId: string };

export class WorkspaceCreatedEvent extends DomainEvent {
  readonly name = WorkspaceEventNames.CREATED;
  readonly ownerId: string;
  readonly workspaceName: string;

  constructor(props: WorkspaceEventProps & { ownerId: string; workspaceName: string }) {
    super(props);
    this.ownerId = props.ownerId;
    this.workspaceName = props.workspaceName;
  }
}

export class WorkspaceRenamedEvent extends DomainEvent {
  readonly name = WorkspaceEventNames.RENAMED;
  readonly workspaceName: string;

  constructor(props: WorkspaceEventProps & { workspaceName: string }) {
    super(props);
    this.workspaceName = props.workspaceName;
  }
}

export class WorkspaceMemberAddedEvent extends DomainEvent {
  readonly name = WorkspaceEventNames.MEMBER_ADDED;
  readonly userId: string;
  readonly role: string;

  constructor(props: WorkspaceEventProps & { userId: string; role: string }) {
    super(props);
    this.userId = props.userId;
    this.role = props.role;
  }
}

export class WorkspaceMemberRoleChangedEvent extends DomainEvent {
  readonly name = WorkspaceEventNames.MEMBER_ROLE_CHANGED;
  readonly userId: string;
  readonly previousRole: string;
  readonly role: string;

  constructor(props: WorkspaceEventProps & { userId: string; previousRole: string; role: string }) {
    super(props);
    this.userId = props.userId;
    this.previousRole = props.previousRole;
    this.role = props.role;
  }
}

export class WorkspaceMemberRemovedEvent extends DomainEvent {
  readonly name = WorkspaceEventNames.MEMBER_REMOVED;
  readonly userId: string;

  constructor(props: WorkspaceEventProps & { userId: string }) {
    super(props);
    this.userId = props.userId;
  }
}
