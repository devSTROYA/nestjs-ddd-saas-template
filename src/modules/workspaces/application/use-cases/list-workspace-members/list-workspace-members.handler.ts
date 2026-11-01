import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { WorkspaceNotFoundError } from '../../../domain/errors/domain.error.js';
import { WORKSPACE_QUERY, type WorkspaceQuery } from '../../ports/workspace.query.js';
import {
  ListWorkspaceMembersQuery,
  type ListWorkspaceMembersResult,
} from './list-workspace-members.query.js';

@QueryHandler(ListWorkspaceMembersQuery)
export class ListWorkspaceMembersHandler implements IQueryHandler<
  ListWorkspaceMembersQuery,
  ListWorkspaceMembersResult
> {
  constructor(@Inject(WORKSPACE_QUERY) private readonly workspaces: WorkspaceQuery) {}

  async execute(query: ListWorkspaceMembersQuery): Promise<ListWorkspaceMembersResult> {
    const found = await this.workspaces.listMembers({
      tenantId: query.tenantId,
      workspaceId: query.workspaceId,
      actorId: query.actorId,
      page: query.page,
      limit: query.limit,
    });
    if (!found) {
      throw new WorkspaceNotFoundError();
    }
    return { ...found, page: query.page, limit: query.limit };
  }
}
