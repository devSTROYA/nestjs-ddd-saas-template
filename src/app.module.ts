import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { ClockModule } from '@common/clock';
import { envFilePaths, validateEnv } from '@common/config';
import { DatabaseModule } from '@common/database';
import { DomainErrorFilter, ERROR_STATUS_REGISTRY } from '@common/errors';
import { OutboxModule } from '@common/outbox';
import { RateLimitGuard, RateLimitModule } from '@common/rate-limit';
import { AuthGuard } from '@modules/auth';
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
    { provide: APP_FILTER, useClass: DomainErrorFilter },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
