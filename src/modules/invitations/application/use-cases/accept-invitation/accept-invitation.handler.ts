import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { CLOCK, type Clock } from '@common/clock';
import { UNIT_OF_WORK, type UnitOfWork } from '@common/database';
import { OTP_SERVICE, type OtpService } from '@common/otp';
import {
  TENANT_REPOSITORY,
  Tenant,
  TenantName,
  type TenantRepository,
  newTenantId,
} from '@modules/tenants';
import { USER_REPOSITORY, User, UserName, type UserRepository, newUserId } from '@modules/users';
import {
  WORKSPACE_REPOSITORY,
  Workspace,
  WorkspaceName,
  type WorkspaceRepository,
  newWorkspaceId,
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
  ): Promise<AcceptInvitationResult | null> {
    const invitation = await this.invitations.findByIdForUpdate(command.invitationId);
    if (!invitation) {
      throw new InvitationNotFoundError(command.invitationId);
    }

    const otpMatches = this.otpService.matches(invitation.id, command.otp, invitation.otpHash);
    if (!invitation.accept(otpMatches, this.clock.now())) {
      await this.invitations.save(invitation);
      return null;
    }

    const tenant = Tenant.create({ id: newTenantId(), name: tenantName });
    const user = User.create({
      id: newUserId(),
      tenantId: tenant.id,
      email: invitation.email,
      name: userName,
    });
    const workspace = Workspace.create({
      id: newWorkspaceId(),
      tenantId: tenant.id,
      name: WorkspaceName.create(tenantName.value),
      ownerId: user.id,
    });
    await this.tenants.save(tenant);
    await this.users.save(user);
    await this.workspaces.save(workspace);
    await this.invitations.save(invitation);
    return { tenantId: tenant.id, userId: user.id, workspaceId: workspace.id };
  }
}
