import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { CLOCK, type Clock } from '@common/clock';
import { UNIT_OF_WORK, type UnitOfWork } from '@common/database';
import { TenantId } from '@modules/tenants';
import { UserId } from '@modules/users';

import { WorkspaceRole } from '../../../domain/entities/workspace-role.js';
import { WorkspaceId } from '../../../domain/value-objects/workspace-id.js';
import { WorkspacePermission } from '../../../domain/value-objects/workspace-permission.js';
import {
  WORKSPACE_ROLE_REPOSITORY,
  type WorkspaceRoleRepository,
} from '../../ports/workspace-role.repository.js';
import { WorkspaceAccess } from '../../workspace-access.js';
import {
  CreateWorkspaceRoleCommand,
  type CreateWorkspaceRoleResult,
} from './create-workspace-role.command.js';

@CommandHandler(CreateWorkspaceRoleCommand)
export class CreateWorkspaceRoleHandler implements ICommandHandler<
  CreateWorkspaceRoleCommand,
  CreateWorkspaceRoleResult
> {
  constructor(
    @Inject(WORKSPACE_ROLE_REPOSITORY) private readonly roles: WorkspaceRoleRepository,
    @Inject(WorkspaceAccess) private readonly access: WorkspaceAccess,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  execute(command: CreateWorkspaceRoleCommand): Promise<CreateWorkspaceRoleResult> {
    return this.unitOfWork.run(async () => {
      const tenantId = TenantId.restore(command.tenantId);
      const workspaceId = WorkspaceId.restore(command.workspaceId);
      const actor = await this.access.lockAndRequire(
        tenantId,
        workspaceId,
        UserId.restore(command.actorId),
        WorkspacePermission.ROLE_MANAGE,
      );
      actor.assertHolds(command.permissions);
      const role = WorkspaceRole.create({
        tenantId,
        workspaceId,
        key: command.key,
        name: command.name,
        permissions: command.permissions,
        createdAt: this.clock.now(),
      });
      await this.roles.save(role);
      return { id: role.id };
    });
  }
}
