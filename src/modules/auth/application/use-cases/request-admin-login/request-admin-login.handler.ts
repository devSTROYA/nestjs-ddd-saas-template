import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { Email } from '@common/primitives';
import { RATE_LIMITER, type RateLimiter } from '@common/rate-limit';
import { ADMIN_REPOSITORY, type AdminRepository } from '@modules/admins';

import { LoginCodes } from '../../login-codes.service.js';
import { LOGIN_CODE_PER_EMAIL } from '../../rate-limits.js';
import { RequestAdminLoginCommand } from './request-admin-login.command.js';

@CommandHandler(RequestAdminLoginCommand)
export class RequestAdminLoginHandler implements ICommandHandler<RequestAdminLoginCommand, void> {
  constructor(
    @Inject(ADMIN_REPOSITORY) private readonly admins: AdminRepository,
    @Inject(LoginCodes) private readonly loginCodes: LoginCodes,
    @Inject(RATE_LIMITER) private readonly rateLimiter: RateLimiter,
  ) {}

  async execute(command: RequestAdminLoginCommand): Promise<void> {
    const email = Email.create(command.email);
    await this.rateLimiter.consume(LOGIN_CODE_PER_EMAIL, email.value);
    if (!(await this.admins.findByEmail(email))) {
      return;
    }
    await this.loginCodes.send(email, null);
  }
}
