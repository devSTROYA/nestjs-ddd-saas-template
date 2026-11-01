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
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  // INFO: The user goes with the membership: a tenant has one workspace, so leaving it ends all access.
  execute(command: RemoveWorkspaceMemberCommand): Promise<void> {
    return this.unitOfWork.run(async () => {
      const tenantId = TenantId.restore(command.tenantId);
      const memberId = UserId.restore(command.memberId);
      const workspace = await this.workspaces.findByIdForUpdate(
        tenantId,
        WorkspaceId.restore(command.workspaceId),
      );
      if (!workspace) {
        throw new WorkspaceNotFoundError();
      }
      workspace.assertOwner(UserId.restore(command.actorId));
      workspace.removeMember(memberId, this.clock.now());
      await this.workspaces.save(workspace);
      await this.users.delete(tenantId, memberId);
    });
  }
}
