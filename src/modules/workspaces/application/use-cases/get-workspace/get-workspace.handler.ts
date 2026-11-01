import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { WorkspaceNotFoundError } from '../../../domain/errors/domain.error.js';
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
      query.tenantId,
      query.workspaceId,
      query.actorId,
    );
    if (!view) {
      throw new WorkspaceNotFoundError();
    }
    return view;
  }
}
