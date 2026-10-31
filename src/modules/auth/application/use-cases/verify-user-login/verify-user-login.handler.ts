import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { CLOCK, type Clock } from '@common/clock';
import { UNIT_OF_WORK, type UnitOfWork } from '@common/database';
import { Email } from '@common/primitives';
import { RATE_LIMITER, type RateLimiter } from '@common/rate-limit';
import type { Nullable } from '@common/types';
import { USER_REPOSITORY, type UserRepository } from '@modules/users';

import { InvalidCredentialsError } from '../../../domain/errors/domain.error.js';
import { newTokenFamilyId } from '../../../domain/value-objects/ids.js';
import { PrincipalType } from '../../../domain/value-objects/principal.js';
import { LoginCodes } from '../../login-codes.service.js';
import { assertVerifyAllowed, recordVerifyFailure } from '../../rate-limits.js';
import { type Session, SessionService } from '../../session.service.js';
import { VerifyUserLoginCommand } from './verify-user-login.command.js';

@CommandHandler(VerifyUserLoginCommand)
export class VerifyUserLoginHandler implements ICommandHandler<VerifyUserLoginCommand, Session> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(LoginCodes) private readonly loginCodes: LoginCodes,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(RATE_LIMITER) private readonly rateLimiter: RateLimiter,
  ) {}

  async execute(command: VerifyUserLoginCommand): Promise<Session> {
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
    const user = await this.users.findByEmail(email);
    if (!user) {
      return null;
    }

    const now = this.clock.now();
    if (!(await this.loginCodes.consume(email, user.tenantId, otp, now))) {
      return null;
    }
    return this.sessions.issue(
      { type: PrincipalType.USER, id: user.id, tenantId: user.tenantId },
      newTokenFamilyId(),
      now,
    );
  }
}
