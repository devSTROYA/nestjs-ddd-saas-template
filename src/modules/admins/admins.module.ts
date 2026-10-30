import { Module } from '@nestjs/common';

import { DATABASE_CONTEXT, DatabaseModule, type DatabaseContext } from '@common/database';

import { ADMIN_REPOSITORY } from './application/ports/admin.repository.js';
import { DrizzleAdminRepository } from './infrastructure/persistence/drizzle-admin.repository.js';

@Module({
  imports: [DatabaseModule],
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
