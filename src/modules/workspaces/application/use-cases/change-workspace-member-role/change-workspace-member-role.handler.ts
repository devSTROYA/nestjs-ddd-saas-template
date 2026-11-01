import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { CLOCK, type Clock } from '@common/clock';
import { UNIT_OF_WORK, type UnitOfWork } from '@common/database';

import { WorkspaceNotFoundError } from '../../../domain/errors/domain.error.js';
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
        command.tenantId,
        command.workspaceId,
      );
      if (!workspace) {
        throw new WorkspaceNotFoundError();
      }
      workspace.assertOwner(command.actorId);
      workspace.changeRole(command.memberId, command.role, this.clock.now());
      await this.workspaces.save(workspace);
    });
  }
}
