import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { CLOCK, type Clock } from '@common/clock';
import { UNIT_OF_WORK, type UnitOfWork } from '@common/database';
import { Email } from '@common/primitives';
import { RATE_LIMITER, type RateLimiter } from '@common/rate-limit';
import type { Nullable } from '@common/types';
import { ADMIN_REPOSITORY, type AdminRepository } from '@modules/admins';

import { InvalidCredentialsError } from '../../../domain/errors/domain.error.js';
import { newTokenFamilyId } from '../../../domain/value-objects/ids.js';
import { PrincipalType } from '../../../domain/value-objects/principal.js';
import { LoginCodes } from '../../login-codes.service.js';
import { assertVerifyAllowed, recordVerifyFailure } from '../../rate-limits.js';
import { type Session, SessionService } from '../../session.service.js';
import { VerifyAdminLoginCommand } from './verify-admin-login.command.js';

@CommandHandler(VerifyAdminLoginCommand)
export class VerifyAdminLoginHandler implements ICommandHandler<VerifyAdminLoginCommand, Session> {
  constructor(
    @Inject(ADMIN_REPOSITORY) private readonly admins: AdminRepository,
    @Inject(LoginCodes) private readonly loginCodes: LoginCodes,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(RATE_LIMITER) private readonly rateLimiter: RateLimiter,
  ) {}

  async execute(command: VerifyAdminLoginCommand): Promise<Session> {
    const email = Email.create(command.email);
    await assertVerifyAllowed(this.rateLimiter, email.value, command.ip);

    const session = await this.unitOfWork.run(() => this.verify(email, command.otp));
    if (!session) {
      await recordVerifyFailure(this.rateLimiter, email.value, command.ip);
      throw new InvalidCredentialsError();
    }
    return session;
  }

  private async verify(email: Email, otp: string): Promise<Nullable<Session>> {
    const now = this.clock.now();
    if (!(await this.loginCodes.consume(email, null, otp, now))) {
      return null;
    }

    const admin = await this.admins.findByEmail(email);
    if (!admin) {
      return null;
    }
    return this.sessions.issue(
      { type: PrincipalType.ADMIN, id: admin.id },
      newTokenFamilyId(),
      now,
    );
  }
}
