import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { CLOCK, type Clock } from '@common/clock';
import { UNIT_OF_WORK, type UnitOfWork } from '@common/database';
import { TenantId } from '@modules/tenants';
import { USER_REPOSITORY, UserId, type UserRepository } from '@modules/users';

import { WorkspaceMemberNotFoundError } from '../../../domain/errors/domain.error.js';
import { WorkspaceId } from '../../../domain/value-objects/workspace-id.js';
import { WorkspacePermission } from '../../../domain/value-objects/workspace-permission.js';
import {
  WORKSPACE_MEMBER_REPOSITORY,
  type WorkspaceMemberRepository,
} from '../../ports/workspace-member.repository.js';
import { WorkspaceAccess } from '../../workspace-access.js';
import { RemoveWorkspaceMemberCommand } from './remove-workspace-member.command.js';

@CommandHandler(RemoveWorkspaceMemberCommand)
export class RemoveWorkspaceMemberHandler implements ICommandHandler<
  RemoveWorkspaceMemberCommand,
  void
> {
  constructor(
    @Inject(WORKSPACE_MEMBER_REPOSITORY) private readonly members: WorkspaceMemberRepository,
    @Inject(WorkspaceAccess) private readonly access: WorkspaceAccess,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  // INFO: The user goes with the membership: a tenant has one workspace, so leaving it ends all access.
  execute(command: RemoveWorkspaceMemberCommand): Promise<void> {
    return this.unitOfWork.run(async () => {
      const tenantId = TenantId.restore(command.tenantId);
      const memberId = UserId.restore(command.memberId);
      const workspaceId = WorkspaceId.restore(command.workspaceId);
      const actor = await this.access.lockAndRequire(
        tenantId,
        workspaceId,
        UserId.restore(command.actorId),
        WorkspacePermission.MEMBER_REMOVE,
      );
      const member = await this.members.findByUser(tenantId, workspaceId, memberId);
      if (!member) {
        throw new WorkspaceMemberNotFoundError(command.memberId);
      }
      actor.assertCanManage(await this.access.role(tenantId, workspaceId, member.roleId));
      const ownerCount = await this.members.countOwners(tenantId, workspaceId);
      member.remove(ownerCount, this.clock.now());
      await this.members.delete(member);
      await this.users.delete(tenantId, memberId);
    });
  }
}
