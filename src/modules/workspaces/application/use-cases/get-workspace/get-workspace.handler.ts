import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { WorkspaceNotFoundError } from '../../../domain/errors/domain.error.js';
import {
  WORKSPACE_REPOSITORY,
  type WorkspaceRepository,
} from '../../ports/workspace.repository.js';
import { GetWorkspaceQuery, type WorkspaceView } from './get-workspace.query.js';

@QueryHandler(GetWorkspaceQuery)
export class GetWorkspaceHandler implements IQueryHandler<GetWorkspaceQuery, WorkspaceView> {
  constructor(@Inject(WORKSPACE_REPOSITORY) private readonly workspaces: WorkspaceRepository) {}

  async execute(query: GetWorkspaceQuery): Promise<WorkspaceView> {
    const workspace = await this.workspaces.findByTenantId(query.tenantId);
    const role = workspace?.roleOf(query.actorId);
    if (!workspace || !role) {
      throw new WorkspaceNotFoundError();
    }
    return {
      id: workspace.id,
      name: workspace.name.value,
      role,
      members: workspace.members,
    };
  }
}
