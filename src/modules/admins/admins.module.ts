import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DATABASE_CONTEXT, DatabaseModule, type DatabaseContext } from '@common/database';

import { adminsConfig } from './admins.config.js';
import { ADMIN_REPOSITORY } from './application/ports/admin.repository.js';
import { DrizzleAdminRepository } from './infrastructure/persistence/drizzle-admin.repository.js';

@Module({
  imports: [ConfigModule.forFeature(adminsConfig), DatabaseModule],
  providers: [
    {
      provide: ADMIN_REPOSITORY,
      inject: [DATABASE_CONTEXT],
      useFactory: (context: DatabaseContext): DrizzleAdminRepository =>
        new DrizzleAdminRepository(context),
    },
  ],
  exports: [ADMIN_REPOSITORY],
})
export class AdminsModule {}
