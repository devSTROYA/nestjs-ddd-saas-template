import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { CLOCK, type Clock } from '@common/clock';
import { UNIT_OF_WORK, type UnitOfWork } from '@common/database';
import { TenantId } from '@modules/tenants';
import { UserId } from '@modules/users';

import {
  WorkspaceMemberNotFoundError,
  WorkspaceNotFoundError,
  WorkspaceOwnerRequiredError,
} from '../../../domain/errors/domain.error.js';
import { WorkspaceId } from '../../../domain/value-objects/workspace-id.js';
import {
  WORKSPACE_MEMBER_REPOSITORY,
  type WorkspaceMemberRepository,
} from '../../ports/workspace-member.repository.js';
import {
  WORKSPACE_REPOSITORY,
  type WorkspaceRepository,
} from '../../ports/workspace.repository.js';
import { ChangeWorkspaceMemberRoleCommand } from './change-workspace-member-role.command.js';

@CommandHandler(ChangeWorkspaceMemberRoleCommand)
export class ChangeWorkspaceMemberRoleHandler implements ICommandHandler<
  ChangeWorkspaceMemberRoleCommand,
  void
> {
  constructor(
    @Inject(WORKSPACE_REPOSITORY) private readonly workspaces: WorkspaceRepository,
    @Inject(WORKSPACE_MEMBER_REPOSITORY) private readonly members: WorkspaceMemberRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  execute(command: ChangeWorkspaceMemberRoleCommand): Promise<void> {
    return this.unitOfWork.run(async () => {
      const tenantId = TenantId.restore(command.tenantId);
      const workspace = await this.workspaces.findByIdForUpdate(
        tenantId,
        WorkspaceId.restore(command.workspaceId),
      );
      if (!workspace) {
        throw new WorkspaceNotFoundError();
      }
      const actor = await this.members.findByUser(
        tenantId,
        workspace.id,
        UserId.restore(command.actorId),
      );
      if (!actor?.isOwner) {
        throw new WorkspaceOwnerRequiredError();
      }
      const member = await this.members.findByUser(
        tenantId,
        workspace.id,
        UserId.restore(command.memberId),
      );
      if (!member) {
        throw new WorkspaceMemberNotFoundError(command.memberId);
      }
      const ownerCount = await this.members.countOwners(tenantId, workspace.id);
      member.changeRole(command.role, ownerCount, this.clock.now());
      await this.members.save(member);
    });
  }
}
