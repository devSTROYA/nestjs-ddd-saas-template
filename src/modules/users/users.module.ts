import { Module } from '@nestjs/common';

import { DATABASE_CONTEXT, DatabaseModule, type DatabaseContext } from '@common/database';

import { USER_REPOSITORY } from './application/ports/user.repository.js';
import { DrizzleUserRepository } from './infrastructure/persistence/drizzle-user.repository.js';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: USER_REPOSITORY,
      inject: [DATABASE_CONTEXT],
      useFactory: (context: DatabaseContext): DrizzleUserRepository =>
        new DrizzleUserRepository(context),
    },
  ],
  exports: [USER_REPOSITORY],
})
export class UsersModule {}
