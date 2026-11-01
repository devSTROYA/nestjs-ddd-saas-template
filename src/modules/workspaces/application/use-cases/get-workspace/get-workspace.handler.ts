import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { TenantId } from '@modules/tenants';
import { UserId } from '@modules/users';

import { WorkspaceNotFoundError } from '../../../domain/errors/domain.error.js';
import { WorkspaceId } from '../../../domain/value-objects/workspace-id.js';
import {
  WORKSPACE_QUERY,
  type WorkspaceQuery,
  type WorkspaceView,
} from '../../ports/workspace.query.js';
import { GetWorkspaceQuery } from './get-workspace.query.js';

@QueryHandler(GetWorkspaceQuery)
export class GetWorkspaceHandler implements IQueryHandler<GetWorkspaceQuery, WorkspaceView> {
  constructor(@Inject(WORKSPACE_QUERY) private readonly workspaces: WorkspaceQuery) {}

  async execute(query: GetWorkspaceQuery): Promise<WorkspaceView> {
    const view = await this.workspaces.findViewFor(
      TenantId.restore(query.tenantId),
      WorkspaceId.restore(query.workspaceId),
      UserId.restore(query.actorId),
    );
    if (!view) {
      throw new WorkspaceNotFoundError();
    }
    return view;
  }
}
