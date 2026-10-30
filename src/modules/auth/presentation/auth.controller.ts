import { Body, Controller, HttpCode, HttpStatus, Inject, Ip, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';

import { Throttle } from '@common/rate-limit';
import { ZodValidationPipe } from '@common/validation';

import type { Session } from '../application/session.service.js';
import { LogoutCommand } from '../application/use-cases/logout/logout.command.js';
import { RefreshTokensCommand } from '../application/use-cases/refresh-tokens/refresh-tokens.command.js';
import { RequestAdminLoginCommand } from '../application/use-cases/request-admin-login/request-admin-login.command.js';
import { RequestUserLoginCommand } from '../application/use-cases/request-user-login/request-user-login.command.js';
import { VerifyAdminLoginCommand } from '../application/use-cases/verify-admin-login/verify-admin-login.command.js';
import { VerifyUserLoginCommand } from '../application/use-cases/verify-user-login/verify-user-login.command.js';
import { Public } from './auth.decorators.js';
import { LOGIN_CODE_PER_IP, LOGIN_VERIFY_PER_IP, REFRESH_PER_IP } from './auth.rate-limits.js';
import {
  type RefreshBody,
  type RequestAdminLoginBody,
  type RequestUserLoginBody,
  type TokenResponse,
  type VerifyAdminLoginBody,
  type VerifyUserLoginBody,
  refreshBodySchema,
  requestAdminLoginBodySchema,
  requestUserLoginBodySchema,
  verifyAdminLoginBodySchema,
  verifyUserLoginBodySchema,
} from './auth.schema.js';

function toTokenResponse(session: Session): TokenResponse {
  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    tokenType: 'Bearer',
    expiresIn: session.expiresInSeconds,
  };
}

@Public()
@Controller('auth')
export class AuthController {
  constructor(@Inject(CommandBus) private readonly commandBus: CommandBus) {}

  @Post('admin/otp')
  @Throttle(LOGIN_CODE_PER_IP)
  @HttpCode(HttpStatus.ACCEPTED)
  async requestAdminLogin(
    @Body(new ZodValidationPipe(requestAdminLoginBodySchema)) body: RequestAdminLoginBody,
  ): Promise<void> {
    await this.commandBus.execute<RequestAdminLoginCommand, void>(
      new RequestAdminLoginCommand(body.email),
    );
  }

  @Post('admin/token')
  @Throttle(LOGIN_VERIFY_PER_IP)
  @HttpCode(HttpStatus.OK)
  async verifyAdminLogin(
    @Body(new ZodValidationPipe(verifyAdminLoginBodySchema)) body: VerifyAdminLoginBody,
    @Ip() ip: string,
  ): Promise<TokenResponse> {
    return toTokenResponse(
      await this.commandBus.execute<VerifyAdminLoginCommand, Session>(
        new VerifyAdminLoginCommand(body.email, body.otp, ip),
      ),
    );
  }

  @Post('user/otp')
  @Throttle(LOGIN_CODE_PER_IP)
  @HttpCode(HttpStatus.ACCEPTED)
  async requestUserLogin(
    @Body(new ZodValidationPipe(requestUserLoginBodySchema)) body: RequestUserLoginBody,
  ): Promise<void> {
    await this.commandBus.execute<RequestUserLoginCommand, void>(
      new RequestUserLoginCommand(body.email),
    );
  }

  @Post('user/token')
  @Throttle(LOGIN_VERIFY_PER_IP)
  @HttpCode(HttpStatus.OK)
  async verifyUserLogin(
    @Body(new ZodValidationPipe(verifyUserLoginBodySchema)) body: VerifyUserLoginBody,
    @Ip() ip: string,
  ): Promise<TokenResponse> {
    return toTokenResponse(
      await this.commandBus.execute<VerifyUserLoginCommand, Session>(
        new VerifyUserLoginCommand(body.email, body.otp, ip),
      ),
    );
  }

  @Post('refresh')
  @Throttle(REFRESH_PER_IP)
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body(new ZodValidationPipe(refreshBodySchema)) body: RefreshBody,
  ): Promise<TokenResponse> {
    return toTokenResponse(
      await this.commandBus.execute<RefreshTokensCommand, Session>(
        new RefreshTokensCommand(body.refreshToken),
      ),
    );
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body(new ZodValidationPipe(refreshBodySchema)) body: RefreshBody): Promise<void> {
    await this.commandBus.execute<LogoutCommand, void>(new LogoutCommand(body.refreshToken));
  }
}
