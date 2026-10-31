import { DomainEvent } from '@common/ddd';

export const WorkspaceEventNames = {
  CREATED: 'workspace.created',
  RENAMED: 'workspace.renamed',
  MEMBER_ADDED: 'workspace.member_added',
  MEMBER_ROLE_CHANGED: 'workspace.member_role_changed',
  MEMBER_REMOVED: 'workspace.member_removed',
} as const;

export class WorkspaceCreatedEvent extends DomainEvent {
  readonly name = WorkspaceEventNames.CREATED;

  constructor(
    aggregateId: string,
    tenantId: string,
    occurredAt: string,
    readonly ownerId: string,
    readonly workspaceName: string,
  ) {
    super(aggregateId, tenantId, occurredAt);
  }
}

export class WorkspaceRenamedEvent extends DomainEvent {
  readonly name = WorkspaceEventNames.RENAMED;

  constructor(
    aggregateId: string,
    tenantId: string,
    occurredAt: string,
    readonly workspaceName: string,
  ) {
    super(aggregateId, tenantId, occurredAt);
  }
}

export class WorkspaceMemberAddedEvent extends DomainEvent {
  readonly name = WorkspaceEventNames.MEMBER_ADDED;

  constructor(
    aggregateId: string,
    tenantId: string,
    occurredAt: string,
    readonly userId: string,
    readonly role: string,
  ) {
    super(aggregateId, tenantId, occurredAt);
  }
}

export class WorkspaceMemberRoleChangedEvent extends DomainEvent {
  readonly name = WorkspaceEventNames.MEMBER_ROLE_CHANGED;

  constructor(
    aggregateId: string,
    tenantId: string,
    occurredAt: string,
    readonly userId: string,
    readonly previousRole: string,
    readonly role: string,
  ) {
    super(aggregateId, tenantId, occurredAt);
  }
}

export class WorkspaceMemberRemovedEvent extends DomainEvent {
  readonly name = WorkspaceEventNames.MEMBER_REMOVED;

  constructor(
    aggregateId: string,
    tenantId: string,
    occurredAt: string,
    readonly userId: string,
  ) {
    super(aggregateId, tenantId, occurredAt);
  }
}
