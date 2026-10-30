import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ClockModule } from '@common/clock';
import type { Env } from '@common/config';
import { DATABASE_CONTEXT, DatabaseModule, type DatabaseContext } from '@common/database';
import { MAIL_TRANSPORT, MailModule, type MailTransport } from '@common/mail';
import { OtpModule } from '@common/otp';
import { RateLimitModule } from '@common/rate-limit';

import { AdminsModule } from '../admins/admins.module.js';
import { UsersModule } from '../users/users.module.js';
import { LOGIN_CHALLENGE_REPOSITORY } from './application/ports/login-challenge.repository.js';
import { LOGIN_MAILER } from './application/ports/login-mailer.js';
import { REFRESH_TOKEN_CODEC } from './application/ports/refresh-token-codec.js';
import { REFRESH_TOKEN_REPOSITORY } from './application/ports/refresh-token.repository.js';
import { TOKEN_SERVICE } from './application/ports/token.service.js';
import { LoginCodes } from './application/login-codes.service.js';
import { SessionService } from './application/session.service.js';
import { RequestUserLoginHandler } from './application/use-cases/request-user-login/request-user-login.handler.js';
import { VerifyUserLoginHandler } from './application/use-cases/verify-user-login/verify-user-login.handler.js';
import { LogoutHandler } from './application/use-cases/logout/logout.handler.js';
import { RefreshTokensHandler } from './application/use-cases/refresh-tokens/refresh-tokens.handler.js';
import { RequestAdminLoginHandler } from './application/use-cases/request-admin-login/request-admin-login.handler.js';
import { VerifyAdminLoginHandler } from './application/use-cases/verify-admin-login/verify-admin-login.handler.js';
import { EmailLoginMailer } from './infrastructure/mail/email-login-mailer.js';
import { DrizzleLoginChallengeRepository } from './infrastructure/persistence/drizzle-login-challenge.repository.js';
import { DrizzleRefreshTokenRepository } from './infrastructure/persistence/drizzle-refresh-token.repository.js';
import { JoseTokenService } from './infrastructure/security/jose-token.service.js';
import { Sha256RefreshTokenCodec } from './infrastructure/security/sha256-refresh-token-codec.js';
import { AuthController } from './presentation/auth.controller.js';

@Module({
  imports: [
    DatabaseModule,
    ClockModule,
    MailModule,
    OtpModule,
    RateLimitModule,
    AdminsModule,
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [
    {
      provide: LOGIN_CHALLENGE_REPOSITORY,
      inject: [DATABASE_CONTEXT],
      useFactory: (context: DatabaseContext): DrizzleLoginChallengeRepository =>
        new DrizzleLoginChallengeRepository(context),
    },
    {
      provide: REFRESH_TOKEN_REPOSITORY,
      inject: [DATABASE_CONTEXT],
      useFactory: (context: DatabaseContext): DrizzleRefreshTokenRepository =>
        new DrizzleRefreshTokenRepository(context),
    },
    {
      provide: TOKEN_SERVICE,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): JoseTokenService =>
        new JoseTokenService(config.get('JWT_SECRET', { infer: true })),
    },
    { provide: REFRESH_TOKEN_CODEC, useClass: Sha256RefreshTokenCodec },
    {
      provide: LOGIN_MAILER,
      inject: [MAIL_TRANSPORT],
      useFactory: (transport: MailTransport): EmailLoginMailer => new EmailLoginMailer(transport),
    },
    SessionService,
    LoginCodes,
    RequestAdminLoginHandler,
    VerifyAdminLoginHandler,
    RequestUserLoginHandler,
    VerifyUserLoginHandler,
    RefreshTokensHandler,
    LogoutHandler,
  ],
  exports: [TOKEN_SERVICE],
})
export class AuthModule {}
