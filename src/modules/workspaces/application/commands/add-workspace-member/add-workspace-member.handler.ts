import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { CLOCK, type Clock } from '@common/clock';
import { UNIT_OF_WORK, type UnitOfWork } from '@common/database';
import { Email } from '@common/primitives';
import { TenantId } from '@modules/tenants';
import {
  EmailAlreadyTakenError,
  USER_REPOSITORY,
  User,
  UserId,
  UserName,
  type UserRepository,
} from '@modules/users';

import { WorkspaceMember } from '../../../domain/entities/workspace-member.js';
import { WorkspaceMemberAlreadyExistsError } from '../../../domain/errors/domain.error.js';
import { WorkspaceId } from '../../../domain/value-objects/workspace-id.js';
import { WorkspacePermission } from '../../../domain/value-objects/workspace-permission.js';
import { WorkspaceRoleId } from '../../../domain/value-objects/workspace-role-id.js';
import {
  WORKSPACE_MEMBER_REPOSITORY,
  type WorkspaceMemberRepository,
} from '../../../domain/ports/workspace-member.repository.js';
import { WorkspaceAccess } from '../../workspace-access.js';
import {
  AddWorkspaceMemberCommand,
  type AddWorkspaceMemberResult,
} from './add-workspace-member.command.js';

// INFO: The added person is a member at once; an unknown email becomes a user of the workspace's tenant.
@CommandHandler(AddWorkspaceMemberCommand)
export class AddWorkspaceMemberHandler implements ICommandHandler<
  AddWorkspaceMemberCommand,
  AddWorkspaceMemberResult
> {
  constructor(
    @Inject(WORKSPACE_MEMBER_REPOSITORY) private readonly members: WorkspaceMemberRepository,
    @Inject(WorkspaceAccess) private readonly access: WorkspaceAccess,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: AddWorkspaceMemberCommand): Promise<AddWorkspaceMemberResult> {
    const email = Email.create(command.email);
    return this.unitOfWork.run(() => this.add(command, email));
  }

  private async add(
    command: AddWorkspaceMemberCommand,
    email: Email,
  ): Promise<AddWorkspaceMemberResult> {
    const tenantId = TenantId.parse(command.tenantId);
    const workspaceId = WorkspaceId.parse(command.workspaceId);
    const actor = await this.access.lockAndRequire(
      tenantId,
      workspaceId,
      UserId.parse(command.actorId),
      WorkspacePermission.MEMBER_ADD,
    );
    const role = await this.access.role(
      tenantId,
      workspaceId,
      WorkspaceRoleId.parse(command.roleId),
    );
    actor.assertCanManage(role);

    const existing = await this.users.findByEmail(email);
    if (existing && existing.tenantId !== tenantId) {
      throw new EmailAlreadyTakenError(email.value);
    }
    if (existing && (await this.members.findByUser(tenantId, workspaceId, existing.id))) {
      throw new WorkspaceMemberAlreadyExistsError(existing.id);
    }
    const now = this.clock.now();
    const user =
      existing ??
      User.create({
        tenantId,
        email,
        name: UserName.create(command.name),
        createdAt: now,
      });

    if (!existing) {
      await this.users.save(user);
    }
    await this.members.save(
      WorkspaceMember.create({
        tenantId,
        workspaceId,
        userId: user.id,
        roleId: role.id,
        createdAt: now,
      }),
    );
    return { userId: user.id };
  }
}
