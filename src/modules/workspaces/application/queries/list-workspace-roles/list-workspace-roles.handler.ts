import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { TenantId } from '@modules/tenants';
import { UserId } from '@modules/users';

import { WorkspaceNotFoundError } from '../../../domain/errors/domain.error.js';
import { WorkspaceId } from '../../../domain/value-objects/workspace-id.js';
import {
  WORKSPACE_ROLE_QUERY,
  type WorkspaceRoleQuery,
  type WorkspaceRoleListItem,
} from '../../ports/workspace-role.query.js';
import { ListWorkspaceRolesQuery } from './list-workspace-roles.query.js';

@QueryHandler(ListWorkspaceRolesQuery)
export class ListWorkspaceRolesHandler implements IQueryHandler<
  ListWorkspaceRolesQuery,
  WorkspaceRoleListItem[]
> {
  constructor(@Inject(WORKSPACE_ROLE_QUERY) private readonly roles: WorkspaceRoleQuery) {}

  async execute(query: ListWorkspaceRolesQuery): Promise<WorkspaceRoleListItem[]> {
    const roles = await this.roles.listFor(
      TenantId.parse(query.tenantId),
      WorkspaceId.parse(query.workspaceId),
      UserId.parse(query.actorId),
    );
    if (!roles) {
      throw new WorkspaceNotFoundError();
    }
    return roles;
  }
}
