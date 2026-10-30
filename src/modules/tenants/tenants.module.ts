import { Module } from '@nestjs/common';

import { DATABASE_CONTEXT, DatabaseModule, type DatabaseContext } from '@common/database';

import { TENANT_REPOSITORY } from './application/ports/tenant.repository.js';
import { DrizzleTenantRepository } from './infrastructure/persistence/drizzle-tenant.repository.js';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: TENANT_REPOSITORY,
      inject: [DATABASE_CONTEXT],
      useFactory: (context: DatabaseContext): DrizzleTenantRepository =>
        new DrizzleTenantRepository(context),
    },
  ],
  exports: [TENANT_REPOSITORY],
})
export class TenantsModule {}
