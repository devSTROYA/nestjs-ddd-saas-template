import { Module } from '@nestjs/common';
import { ConfigModule, type ConfigType } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { ClockModule } from '@common/clock';
import { appConfig, docsConfig, envFilePaths, loggingConfig } from '@common/config';
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
    }),
    ConfigModule.forFeature(appConfig),
    ConfigModule.forFeature(docsConfig),
    LoggerModule.forRootAsync({
      imports: [ConfigModule.forFeature(loggingConfig), ConfigModule.forFeature(appConfig)],
      inject: [loggingConfig.KEY, appConfig.KEY],
      useFactory: (logging: ConfigType<typeof loggingConfig>, app: ConfigType<typeof appConfig>) =>
        loggerParams({
          level: logging.level,
          quietPath: `/${API_PREFIX}/health`,
          nodeEnv: app.nodeEnv,
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
