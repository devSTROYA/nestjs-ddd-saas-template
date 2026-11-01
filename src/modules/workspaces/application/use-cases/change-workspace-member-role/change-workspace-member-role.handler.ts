import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { CLOCK, type Clock } from '@common/clock';
import { UNIT_OF_WORK, type UnitOfWork } from '@common/database';
import { TenantId } from '@modules/tenants';
import { UserId } from '@modules/users';

import { WorkspaceNotFoundError } from '../../../domain/errors/domain.error.js';
import { WorkspaceId } from '../../../domain/value-objects/workspace-id.js';
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
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  execute(command: ChangeWorkspaceMemberRoleCommand): Promise<void> {
    return this.unitOfWork.run(async () => {
      const workspace = await this.workspaces.findByIdForUpdate(
        TenantId.restore(command.tenantId),
        WorkspaceId.restore(command.workspaceId),
      );
      if (!workspace) {
        throw new WorkspaceNotFoundError();
      }
      workspace.assertOwner(UserId.restore(command.actorId));
      workspace.changeRole(UserId.restore(command.memberId), command.role, this.clock.now());
      await this.workspaces.save(workspace);
    });
  }
}
