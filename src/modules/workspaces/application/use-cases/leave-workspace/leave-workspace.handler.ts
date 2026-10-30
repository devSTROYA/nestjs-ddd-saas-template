import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { UNIT_OF_WORK, type UnitOfWork } from '@common/database';
import { USER_REPOSITORY, type UserRepository } from '@modules/users';

import { WorkspaceNotFoundError } from '../../../domain/errors/domain.error.js';
import {
  WORKSPACE_REPOSITORY,
  type WorkspaceRepository,
} from '../../ports/workspace.repository.js';
import { LeaveWorkspaceCommand } from './leave-workspace.command.js';

@CommandHandler(LeaveWorkspaceCommand)
export class LeaveWorkspaceHandler implements ICommandHandler<LeaveWorkspaceCommand, void> {
  constructor(
    @Inject(WORKSPACE_REPOSITORY) private readonly workspaces: WorkspaceRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  execute(command: LeaveWorkspaceCommand): Promise<void> {
    return this.unitOfWork.run(async () => {
      const workspace = await this.workspaces.findByTenantIdForUpdate(command.tenantId);
      if (!workspace) {
        throw new WorkspaceNotFoundError();
      }
      workspace.removeMember(command.actorId);
      await this.workspaces.save(workspace);
      await this.users.delete(command.tenantId, command.actorId);
    });
  }
}
