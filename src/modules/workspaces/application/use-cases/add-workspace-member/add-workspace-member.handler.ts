import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { UNIT_OF_WORK, type UnitOfWork } from '@common/database';
import { Email } from '@common/primitives';
import {
  EmailAlreadyTakenError,
  USER_REPOSITORY,
  User,
  UserName,
  type UserRepository,
  newUserId,
} from '@modules/users';

import { WorkspaceNotFoundError } from '../../../domain/errors/domain.error.js';
import {
  WORKSPACE_REPOSITORY,
  type WorkspaceRepository,
} from '../../ports/workspace.repository.js';
import {
  AddWorkspaceMemberCommand,
  type AddWorkspaceMemberResult,
} from './add-workspace-member.command.js';

// Whoever an owner adds becomes a member at once, with no invitation or acceptance. An email that
// is not a user yet becomes a user of the workspace's tenant and logs in with a one-time code.
@CommandHandler(AddWorkspaceMemberCommand)
export class AddWorkspaceMemberHandler implements ICommandHandler<
  AddWorkspaceMemberCommand,
  AddWorkspaceMemberResult
> {
  constructor(
    @Inject(WORKSPACE_REPOSITORY) private readonly workspaces: WorkspaceRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: AddWorkspaceMemberCommand): Promise<AddWorkspaceMemberResult> {
    const email = Email.create(command.email);
    return this.unitOfWork.run(() => this.add(command, email));
  }

  private async add(
    command: AddWorkspaceMemberCommand,
    email: Email,
  ): Promise<AddWorkspaceMemberResult> {
    const workspace = await this.workspaces.findByTenantIdForUpdate(command.tenantId);
    if (!workspace) {
      throw new WorkspaceNotFoundError();
    }
    workspace.assertOwner(command.actorId);

    const existing = await this.users.findByEmail(email);
    if (existing && existing.tenantId !== command.tenantId) {
      throw new EmailAlreadyTakenError(email.value);
    }
    const user =
      existing ??
      User.create({
        id: newUserId(),
        tenantId: command.tenantId,
        email,
        name: UserName.create(command.name),
      });

    workspace.addMember(user.id, command.role);
    if (!existing) {
      await this.users.save(user);
    }
    await this.workspaces.save(workspace);
    return { userId: user.id };
  }
}
