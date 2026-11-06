import { and, eq } from 'drizzle-orm';

import type { DatabaseContext } from '@common/database';
import { saveAggregate } from '@common/outbox';
import type { Nullable } from '@common/types';
import { TenantId } from '@modules/tenants';

import type { WorkspaceRepository } from '../../domain/ports/workspace.repository.js';
import { Workspace } from '../../domain/entities/workspace.js';
import { WorkspaceIdConflictError } from '../../domain/errors/domain.error.js';
import { WorkspaceId } from '../../domain/value-objects/workspace-id.js';
import { WorkspaceName } from '../../domain/value-objects/workspace-name.js';
import { workspaces, type WorkspaceRow } from './workspace.schema.js';

function toWorkspace(row: WorkspaceRow): Workspace {
  return Workspace.rehydrate(
    {
      tenantId: TenantId.rehydrate(row.tenantId),
      name: WorkspaceName.rehydrate(row.name),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    },
    WorkspaceId.rehydrate(row.id),
  );
}

export class DrizzleWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly context: DatabaseContext) {}

  findById(tenantId: TenantId, id: WorkspaceId): Promise<Nullable<Workspace>> {
    return this.find(tenantId, id, false);
  }

  findByIdForUpdate(tenantId: TenantId, id: WorkspaceId): Promise<Nullable<Workspace>> {
    return this.find(tenantId, id, true);
  }

  save(workspace: Workspace): Promise<void> {
    return saveAggregate(this.context, workspace, () => this.write(workspace));
  }

  private async write(workspace: Workspace): Promise<void> {
    const name = workspace.name.value;
    const written = await this.context.client
      .insert(workspaces)
      .values({
        id: workspace.id,
        tenantId: workspace.tenantId,
        name,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      })
      .onConflictDoUpdate({
        target: workspaces.id,
        set: { name, updatedAt: workspace.updatedAt },
        setWhere: eq(workspaces.tenantId, workspace.tenantId),
      })
      .returning({ id: workspaces.id });
    if (written.length === 0) {
      throw new WorkspaceIdConflictError(workspace.id);
    }
  }

  private async find(
    tenantId: TenantId,
    id: WorkspaceId,
    lock: boolean,
  ): Promise<Nullable<Workspace>> {
    const query = this.context.client
      .select()
      .from(workspaces)
      .where(and(eq(workspaces.id, id), eq(workspaces.tenantId, tenantId)));
    const [row] = await (lock ? query.for('update') : query);
    return row ? toWorkspace(row) : null;
  }
}
