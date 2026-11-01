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

import { WorkspaceNotFoundError } from '../../../domain/errors/domain.error.js';
import { WorkspaceId } from '../../../domain/value-objects/workspace-id.js';
import {
  WORKSPACE_REPOSITORY,
  type WorkspaceRepository,
} from '../../ports/workspace.repository.js';
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
    @Inject(WORKSPACE_REPOSITORY) private readonly workspaces: WorkspaceRepository,
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
    const actorId = UserId.restore(command.actorId);
    const tenantId = TenantId.restore(command.tenantId);
    const workspace = await this.workspaces.findByIdForUpdate(
      tenantId,
      WorkspaceId.restore(command.workspaceId),
    );
    if (!workspace) {
      throw new WorkspaceNotFoundError();
    }
    workspace.assertOwner(actorId);

    const existing = await this.users.findByEmail(email);
    if (existing && !existing.tenantId.equals(tenantId)) {
      throw new EmailAlreadyTakenError(email.value);
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

    workspace.addMember(user.id, command.role, now);
    if (!existing) {
      await this.users.save(user);
    }
    await this.workspaces.save(workspace);
    return { userId: user.id };
  }
}
