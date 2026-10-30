import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { Email } from '@common/primitives';
import { RATE_LIMITER, type RateLimiter } from '@common/rate-limit';
import { USER_REPOSITORY, type UserRepository } from '@modules/users';

import { LoginCodes } from '../../login-codes.service.js';
import { LOGIN_CODE_PER_EMAIL } from '../../rate-limits.js';
import { RequestUserLoginCommand } from './request-user-login.command.js';

@CommandHandler(RequestUserLoginCommand)
export class RequestUserLoginHandler implements ICommandHandler<RequestUserLoginCommand, void> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(LoginCodes) private readonly loginCodes: LoginCodes,
    @Inject(RATE_LIMITER) private readonly rateLimiter: RateLimiter,
  ) {}

  async execute(command: RequestUserLoginCommand): Promise<void> {
    const email = Email.create(command.email);
    await this.rateLimiter.consume(LOGIN_CODE_PER_EMAIL, email.value);

    const user = await this.users.findByEmail(email);
    if (!user) {
      return;
    }
    await this.loginCodes.send(email, user.tenantId);
  }
}
