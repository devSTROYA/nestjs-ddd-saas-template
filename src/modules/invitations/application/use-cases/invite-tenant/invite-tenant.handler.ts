import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { CLOCK, type Clock } from '@common/clock';
import { OTP_SERVICE, type OtpService } from '@common/otp';
import { Email } from '@common/primitives';
import { USER_REPOSITORY, type UserRepository } from '@modules/users';

import { Invitation } from '../../../domain/entities/invitation.js';
import { InvitationEmailAlreadyRegisteredError } from '../../../domain/errors/domain.error.js';
import { type InvitationId, newInvitationId } from '../../../domain/value-objects/invitation-id.js';
import {
  INVITATION_REPOSITORY,
  type InvitationRepository,
} from '../../ports/invitation.repository.js';
import { MAILER, type Mailer } from '../../ports/mailer.js';
import { InviteTenantCommand } from './invite-tenant.command.js';

const DAY_MS = 24 * 60 * 60 * 1000;
export const INVITATION_TTL_MS = 7 * DAY_MS;

@CommandHandler(InviteTenantCommand)
export class InviteTenantHandler implements ICommandHandler<InviteTenantCommand, InvitationId> {
  constructor(
    @Inject(INVITATION_REPOSITORY) private readonly invitations: InvitationRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(OTP_SERVICE) private readonly otpService: OtpService,
    @Inject(MAILER) private readonly mailer: Mailer,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: InviteTenantCommand): Promise<InvitationId> {
    const email = Email.create(command.email);
    if (await this.users.findByEmail(email)) {
      throw new InvitationEmailAlreadyRegisteredError(email.value);
    }
    const now = this.clock.now();
    const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS);
    const otp = this.otpService.generate();

    const pending = await this.invitations.findPendingByEmail(email);
    const invitation = pending ?? this.newInvitation(command, email, expiresAt, now, otp);
    if (pending) {
      pending.regenerate(this.otpService.hash(pending.id, otp), expiresAt);
    }

    await this.invitations.save(invitation);
    await this.mailer.sendInvitationOtp({
      to: email,
      invitationId: invitation.id,
      otp,
      expiresAt,
    });
    return invitation.id;
  }

  private newInvitation(
    command: InviteTenantCommand,
    email: Email,
    expiresAt: Date,
    now: Date,
    otp: string,
  ): Invitation {
    const id = newInvitationId();
    return Invitation.create(
      {
        email,
        invitedBy: command.adminId,
        otpHash: this.otpService.hash(id, otp),
        expiresAt,
      },
      id,
      now,
    );
  }
}
