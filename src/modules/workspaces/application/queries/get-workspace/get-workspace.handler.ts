import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { TenantId } from '@modules/tenants';
import { UserId } from '@modules/users';

import { WorkspaceNotFoundError } from '../../../domain/errors/domain.error.js';
import { WorkspaceId } from '../../../domain/value-objects/workspace-id.js';
import {
  WORKSPACE_QUERY,
  type WorkspaceQuery,
  type WorkspaceDetail,
} from '../../ports/workspace.query.js';
import { GetWorkspaceQuery } from './get-workspace.query.js';

@QueryHandler(GetWorkspaceQuery)
export class GetWorkspaceHandler implements IQueryHandler<GetWorkspaceQuery, WorkspaceDetail> {
  constructor(@Inject(WORKSPACE_QUERY) private readonly workspaces: WorkspaceQuery) {}

  async execute(query: GetWorkspaceQuery): Promise<WorkspaceDetail> {
    const view = await this.workspaces.findDetailFor(
      TenantId.parse(query.tenantId),
      WorkspaceId.parse(query.workspaceId),
      UserId.parse(query.actorId),
    );
    if (!view) {
      throw new WorkspaceNotFoundError();
    }
    return view;
  }
}
