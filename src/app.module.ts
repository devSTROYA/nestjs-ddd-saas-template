import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { ClockModule } from '@common/clock';
import { type Env, envFilePaths, validateEnv } from '@common/config';
import { DatabaseModule } from '@common/database';
import { ERROR_STATUS_REGISTRY, ErrorFilter } from '@common/errors';
import { loggerParams } from '@common/logging';
import { OutboxModule } from '@common/outbox';
import { RateLimitGuard, RateLimitModule } from '@common/rate-limit';
import { AuthGuard } from '@modules/auth';
import { LoggerModule } from 'nestjs-pino';
import { API_PREFIX } from './api-prefix.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { errorStatus } from './error-status.js';
import { HealthModule } from './health/health.module.js';
import { AdminsModule } from './modules/admins/admins.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { InvitationsModule } from './modules/invitations/invitations.module.js';
import { TenantsModule } from './modules/tenants/tenants.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { WorkspacesModule } from './modules/workspaces/workspaces.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: envFilePaths(),
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        loggerParams({
          level: config.get('LOG_LEVEL', { infer: true }),
          quietPath: `/${API_PREFIX}/health`,
        }),
    }),
    CqrsModule.forRoot(),
    ClockModule,
    DatabaseModule,
    OutboxModule,
    RateLimitModule,
    HealthModule,
    AdminsModule,
    AuthModule,
    InvitationsModule,
    TenantsModule,
    UsersModule,
    WorkspacesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: ERROR_STATUS_REGISTRY, useValue: errorStatus },
    { provide: APP_FILTER, useClass: ErrorFilter },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
