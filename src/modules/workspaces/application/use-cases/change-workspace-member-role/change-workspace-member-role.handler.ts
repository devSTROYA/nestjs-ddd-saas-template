import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { CLOCK, type Clock } from '@common/clock';
import { UNIT_OF_WORK, type UnitOfWork } from '@common/database';
import { TenantId } from '@modules/tenants';
import { UserId } from '@modules/users';

import { WorkspaceMemberNotFoundError } from '../../../domain/errors/domain.error.js';
import { WorkspaceId } from '../../../domain/value-objects/workspace-id.js';
import { WorkspacePermission } from '../../../domain/value-objects/workspace-permission.js';
import { WorkspaceRoleId } from '../../../domain/value-objects/workspace-role-id.js';
import {
  WORKSPACE_MEMBER_REPOSITORY,
  type WorkspaceMemberRepository,
} from '../../../domain/ports/workspace-member.repository.js';
import { WorkspaceAccess } from '../../workspace-access.js';
import { ChangeWorkspaceMemberRoleCommand } from './change-workspace-member-role.command.js';

@CommandHandler(ChangeWorkspaceMemberRoleCommand)
export class ChangeWorkspaceMemberRoleHandler implements ICommandHandler<
  ChangeWorkspaceMemberRoleCommand,
  void
> {
  constructor(
    @Inject(WORKSPACE_MEMBER_REPOSITORY) private readonly members: WorkspaceMemberRepository,
    @Inject(WorkspaceAccess) private readonly access: WorkspaceAccess,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  execute(command: ChangeWorkspaceMemberRoleCommand): Promise<void> {
    return this.unitOfWork.run(async () => {
      const tenantId = TenantId.restore(command.tenantId);
      const workspaceId = WorkspaceId.restore(command.workspaceId);
      const actor = await this.access.lockAndRequire(
        tenantId,
        workspaceId,
        UserId.restore(command.actorId),
        WorkspacePermission.MEMBER_CHANGE_ROLE,
      );
      const member = await this.members.findByUser(
        tenantId,
        workspaceId,
        UserId.restore(command.memberId),
      );
      if (!member) {
        throw new WorkspaceMemberNotFoundError(command.memberId);
      }
      const current = await this.access.role(tenantId, workspaceId, member.roleId);
      const next = await this.access.role(
        tenantId,
        workspaceId,
        WorkspaceRoleId.restore(command.roleId),
      );
      actor.assertCanManage(current);
      actor.assertCanManage(next);
      const ownerCount = await this.members.countOwners(tenantId, workspaceId);
      if (member.changeRole(next.id, ownerCount, this.clock.now())) {
        await this.members.save(member);
      }
    });
  }
}
