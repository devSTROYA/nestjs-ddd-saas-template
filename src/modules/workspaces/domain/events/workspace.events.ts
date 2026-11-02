import { DomainEvent, type DomainEventProps } from '@common/ddd';

export const WorkspaceEventNames = {
  CREATED: 'workspace.created',
  RENAMED: 'workspace.renamed',
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
