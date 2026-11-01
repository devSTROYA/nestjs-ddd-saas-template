import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { CLOCK, type Clock } from '@common/clock';
import { UNIT_OF_WORK, type UnitOfWork } from '@common/database';
import { OTP_SERVICE, type OtpService } from '@common/otp';
import type { Nullable } from '@common/types';
import { TENANT_REPOSITORY, Tenant, TenantName, type TenantRepository } from '@modules/tenants';
import { USER_REPOSITORY, User, UserName, type UserRepository } from '@modules/users';
import {
  WORKSPACE_REPOSITORY,
  Workspace,
  WorkspaceName,
  type WorkspaceRepository,
} from '@modules/workspaces';

import { InvalidOtpError, InvitationNotFoundError } from '../../../domain/errors/domain.error.js';
import {
  INVITATION_REPOSITORY,
  type InvitationRepository,
} from '../../ports/invitation.repository.js';
import {
  AcceptInvitationCommand,
  type AcceptInvitationResult,
} from './accept-invitation.command.js';

@CommandHandler(AcceptInvitationCommand)
export class AcceptInvitationHandler implements ICommandHandler<
  AcceptInvitationCommand,
  AcceptInvitationResult
> {
  constructor(
    @Inject(INVITATION_REPOSITORY) private readonly invitations: InvitationRepository,
    @Inject(TENANT_REPOSITORY) private readonly tenants: TenantRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(WORKSPACE_REPOSITORY) private readonly workspaces: WorkspaceRepository,
    @Inject(OTP_SERVICE) private readonly otpService: OtpService,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: AcceptInvitationCommand): Promise<AcceptInvitationResult> {
    const tenantName = TenantName.create(command.tenantName);
    const userName = UserName.create(command.userName);

    const result = await this.unitOfWork.run(() => this.accept(command, tenantName, userName));
    if (!result) {
      throw new InvalidOtpError();
    }
    return result;
  }

  private async accept(
    command: AcceptInvitationCommand,
    tenantName: TenantName,
    userName: UserName,
  ): Promise<Nullable<AcceptInvitationResult>> {
    const invitation = await this.invitations.findByIdForUpdate(command.invitationId);
    if (!invitation) {
      throw new InvitationNotFoundError(command.invitationId.value);
    }

    const otpMatches = this.otpService.matches(
      invitation.id.value,
      command.otp,
      invitation.otpHash,
    );
    const now = this.clock.now();
    if (!invitation.accept(otpMatches, now)) {
      await this.invitations.save(invitation);
      return null;
    }

    const tenant = Tenant.create({ name: tenantName, createdAt: now });
    const user = User.create({
      tenantId: tenant.id,
      email: invitation.email,
      name: userName,
      createdAt: now,
    });
    const workspace = Workspace.create({
      tenantId: tenant.id,
      name: WorkspaceName.create(tenantName.value),
      ownerId: user.id,
      createdAt: now,
    });
    await this.tenants.save(tenant);
    await this.users.save(user);
    await this.workspaces.save(workspace);
    await this.invitations.save(invitation);
    return { tenantId: tenant.id, userId: user.id, workspaceId: workspace.id };
  }
}
