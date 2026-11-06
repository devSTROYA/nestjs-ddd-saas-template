import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { TenantId } from '@modules/tenants';
import { UserId } from '@modules/users';

import { WorkspaceNotFoundError } from '../../../domain/errors/domain.error.js';
import { WorkspaceId } from '../../../domain/value-objects/workspace-id.js';
import {
  WORKSPACE_MEMBER_QUERY,
  type WorkspaceMemberQuery,
} from '../../ports/workspace-member.query.js';
import {
  ListWorkspaceMembersQuery,
  type ListWorkspaceMembersResult,
} from './list-workspace-members.query.js';

@QueryHandler(ListWorkspaceMembersQuery)
export class ListWorkspaceMembersHandler implements IQueryHandler<
  ListWorkspaceMembersQuery,
  ListWorkspaceMembersResult
> {
  constructor(@Inject(WORKSPACE_MEMBER_QUERY) private readonly members: WorkspaceMemberQuery) {}

  async execute(query: ListWorkspaceMembersQuery): Promise<ListWorkspaceMembersResult> {
    const found = await this.members.list({
      tenantId: TenantId.restore(query.tenantId),
      workspaceId: WorkspaceId.restore(query.workspaceId),
      actorId: UserId.restore(query.actorId),
      page: query.page,
      limit: query.limit,
    });
    if (!found) {
      throw new WorkspaceNotFoundError();
    }
    return { ...found, page: query.page, limit: query.limit };
  }
}
