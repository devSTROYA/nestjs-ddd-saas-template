import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { UNIT_OF_WORK, type UnitOfWork } from '@common/database';
import { USER_REPOSITORY, type UserRepository } from '@modules/users';

import { WorkspaceNotFoundError } from '../../../domain/errors/domain.error.js';
import {
  WORKSPACE_REPOSITORY,
  type WorkspaceRepository,
} from '../../ports/workspace.repository.js';
import { RemoveWorkspaceMemberCommand } from './remove-workspace-member.command.js';

@CommandHandler(RemoveWorkspaceMemberCommand)
export class RemoveWorkspaceMemberHandler implements ICommandHandler<
  RemoveWorkspaceMemberCommand,
  void
> {
  constructor(
    @Inject(WORKSPACE_REPOSITORY) private readonly workspaces: WorkspaceRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  // The user goes with the membership: a tenant has one workspace, so leaving it ends all access
  // (login and refresh both need the user row).
  execute(command: RemoveWorkspaceMemberCommand): Promise<void> {
    return this.unitOfWork.run(async () => {
      const workspace = await this.workspaces.findByTenantIdForUpdate(command.tenantId);
      if (!workspace) {
        throw new WorkspaceNotFoundError();
      }
      workspace.assertOwner(command.actorId);
      workspace.removeMember(command.memberId);
      await this.workspaces.save(workspace);
      await this.users.delete(command.tenantId, command.memberId);
    });
  }
}
