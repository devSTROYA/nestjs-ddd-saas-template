import { Inject, Injectable } from '@nestjs/common';

import type { TenantId } from '@modules/tenants';
import type { UserId } from '@modules/users';

import type { WorkspaceRole } from '../domain/entities/workspace-role.js';
import {
  WorkspaceNotFoundError,
  WorkspacePermissionDeniedError,
  WorkspaceRoleNotFoundError,
} from '../domain/errors/domain.error.js';
import type { WorkspaceId } from '../domain/value-objects/workspace-id.js';
import type { WorkspacePermission } from '../domain/value-objects/workspace-permission.js';
import type { WorkspaceRoleId } from '../domain/value-objects/workspace-role-id.js';
import {
  WORKSPACE_MEMBER_REPOSITORY,
  type WorkspaceMemberRepository,
} from '../domain/ports/workspace-member.repository.js';
import {
  WORKSPACE_ROLE_REPOSITORY,
  type WorkspaceRoleRepository,
} from '../domain/ports/workspace-role.repository.js';
import {
  WORKSPACE_REPOSITORY,
  type WorkspaceRepository,
} from '../domain/ports/workspace.repository.js';

// INFO: Handlers call this inside their transaction; it locks the workspace before the check, so a role cannot change between the check and the write.
@Injectable()
export class WorkspaceAccess {
  constructor(
    @Inject(WORKSPACE_REPOSITORY) private readonly workspaces: WorkspaceRepository,
    @Inject(WORKSPACE_MEMBER_REPOSITORY) private readonly members: WorkspaceMemberRepository,
    @Inject(WORKSPACE_ROLE_REPOSITORY) private readonly roles: WorkspaceRoleRepository,
  ) {}

  async role(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    roleId: WorkspaceRoleId,
  ): Promise<WorkspaceRole> {
    const role = await this.roles.findById(tenantId, workspaceId, roleId);
    if (!role) {
      throw new WorkspaceRoleNotFoundError(roleId.value);
    }
    return role;
  }

  async lockAndRequire(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    actorId: UserId,
    permission: WorkspacePermission,
  ): Promise<WorkspaceRole> {
    if (!(await this.workspaces.findByIdForUpdate(tenantId, workspaceId))) {
      throw new WorkspaceNotFoundError();
    }
    const actor = await this.members.findByUser(tenantId, workspaceId, actorId);
    if (!actor) {
      throw new WorkspacePermissionDeniedError([permission]);
    }
    const role = await this.role(tenantId, workspaceId, actor.roleId);
    role.require(permission);
    return role;
  }
}
