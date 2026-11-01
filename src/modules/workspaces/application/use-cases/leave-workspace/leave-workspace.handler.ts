import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { CLOCK, type Clock } from '@common/clock';
import { UNIT_OF_WORK, type UnitOfWork } from '@common/database';
import { TenantId } from '@modules/tenants';
import { USER_REPOSITORY, UserId, type UserRepository } from '@modules/users';

import { WorkspaceNotFoundError } from '../../../domain/errors/domain.error.js';
import { WorkspaceId } from '../../../domain/value-objects/workspace-id.js';
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
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  execute(command: LeaveWorkspaceCommand): Promise<void> {
    return this.unitOfWork.run(async () => {
      const tenantId = TenantId.restore(command.tenantId);
      const actorId = UserId.restore(command.actorId);
      const workspace = await this.workspaces.findByIdForUpdate(
        tenantId,
        WorkspaceId.restore(command.workspaceId),
      );
      if (!workspace) {
        throw new WorkspaceNotFoundError();
      }
      workspace.removeMember(actorId, this.clock.now());
      await this.workspaces.save(workspace);
      await this.users.delete(tenantId, actorId);
    });
  }
}
