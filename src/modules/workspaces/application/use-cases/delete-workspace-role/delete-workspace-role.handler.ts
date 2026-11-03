import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { CLOCK, type Clock } from '@common/clock';
import { UNIT_OF_WORK, type UnitOfWork } from '@common/database';
import { TenantId } from '@modules/tenants';
import { UserId } from '@modules/users';

import {
  SystemWorkspaceRoleError,
  WorkspaceRoleInUseError,
} from '../../../domain/errors/domain.error.js';
import { WorkspaceId } from '../../../domain/value-objects/workspace-id.js';
import { WorkspacePermission } from '../../../domain/value-objects/workspace-permission.js';
import { WorkspaceRoleId } from '../../../domain/value-objects/workspace-role-id.js';
import {
  WORKSPACE_MEMBER_REPOSITORY,
  type WorkspaceMemberRepository,
} from '../../ports/workspace-member.repository.js';
import {
  WORKSPACE_ROLE_REPOSITORY,
  type WorkspaceRoleRepository,
} from '../../ports/workspace-role.repository.js';
import { WorkspaceAccess } from '../../workspace-access.js';
import { DeleteWorkspaceRoleCommand } from './delete-workspace-role.command.js';

@CommandHandler(DeleteWorkspaceRoleCommand)
export class DeleteWorkspaceRoleHandler implements ICommandHandler<
  DeleteWorkspaceRoleCommand,
  void
> {
  constructor(
    @Inject(WORKSPACE_ROLE_REPOSITORY) private readonly roles: WorkspaceRoleRepository,
    @Inject(WORKSPACE_MEMBER_REPOSITORY) private readonly members: WorkspaceMemberRepository,
    @Inject(WorkspaceAccess) private readonly access: WorkspaceAccess,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  execute(command: DeleteWorkspaceRoleCommand): Promise<void> {
    return this.unitOfWork.run(async () => {
      const tenantId = TenantId.restore(command.tenantId);
      const workspaceId = WorkspaceId.restore(command.workspaceId);
      const actor = await this.access.lockAndRequire(
        tenantId,
        workspaceId,
        UserId.restore(command.actorId),
        WorkspacePermission.ROLE_MANAGE,
      );
      const role = await this.access.role(
        tenantId,
        workspaceId,
        WorkspaceRoleId.restore(command.roleId),
      );
      if (role.isSystem) {
        throw new SystemWorkspaceRoleError(role.key);
      }
      actor.assertCanManage(role);
      if ((await this.members.countWithRole(tenantId, workspaceId, role.id)) > 0) {
        throw new WorkspaceRoleInUseError(role.key);
      }
      role.remove(this.clock.now());
      await this.roles.delete(role);
    });
  }
}
