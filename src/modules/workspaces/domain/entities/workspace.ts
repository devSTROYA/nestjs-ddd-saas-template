import { AggregateRoot } from '@common/ddd';
import type { TenantId } from '@modules/tenants';
import type { UserId } from '@modules/users';

import { WorkspaceCreatedEvent, WorkspaceRenamedEvent } from '../events/workspace.events.js';
import { WorkspaceId } from '../value-objects/workspace-id.js';
import type { WorkspaceName } from '../value-objects/workspace-name.js';

type Props = {
  tenantId: TenantId;
  name: WorkspaceName;
  createdAt: Date;
  updatedAt: Date;
};

type CreateProps = {
  tenantId: TenantId;
  name: WorkspaceName;
  ownerId: UserId;
  createdAt: Date;
};

export class Workspace extends AggregateRoot<Props, WorkspaceId> {
  static create(props: CreateProps): Workspace {
    const id = WorkspaceId.create();
    const workspace = new Workspace(
      {
        tenantId: props.tenantId,
        name: props.name,
        createdAt: props.createdAt,
        updatedAt: props.createdAt,
      },
      id,
    );
    workspace.addEvent(
      new WorkspaceCreatedEvent({
        aggregateId: id.value,
        tenantId: props.tenantId.value,
        occurredAt: props.createdAt.toISOString(),
        ownerId: props.ownerId.value,
        workspaceName: props.name.value,
      }),
    );
    return workspace;
  }

  static restore(props: Props, id: WorkspaceId): Workspace {
    return new Workspace(props, id);
  }

  get tenantId(): TenantId {
    return this.props.tenantId;
  }

  get name(): WorkspaceName {
    return this.props.name;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  rename(name: WorkspaceName, now: Date): void {
    this.props.name = name;
    this.props.updatedAt = now;
    this.addEvent(
      new WorkspaceRenamedEvent({
        aggregateId: this.id.value,
        tenantId: this.props.tenantId.value,
        occurredAt: now.toISOString(),
        workspaceName: name.value,
      }),
    );
  }
}
