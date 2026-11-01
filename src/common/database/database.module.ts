import { Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigModule, type ConfigType } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { DATABASE, DATABASE_CONTEXT, type Database, DatabaseContext } from './database-context.js';
import { databaseConfig } from './database.config.js';
import { UNIT_OF_WORK } from './unit-of-work.js';

const PG_POOL = Symbol('PG_POOL');

@Module({
  imports: [ConfigModule.forFeature(databaseConfig)],
  providers: [
    {
      provide: PG_POOL,
      inject: [databaseConfig.KEY],
      useFactory: (config: ConfigType<typeof databaseConfig>): Pool =>
        new Pool({ connectionString: config.url, max: config.poolMax }),
    },
    {
      provide: DATABASE,
      inject: [PG_POOL],
      useFactory: (pool: Pool): Database => drizzle(pool),
    },
    {
      provide: DATABASE_CONTEXT,
      inject: [DATABASE],
      useFactory: (database: Database): DatabaseContext => new DatabaseContext(database),
    },
    { provide: UNIT_OF_WORK, useExisting: DATABASE_CONTEXT },
  ],
  exports: [DATABASE, DATABASE_CONTEXT, UNIT_OF_WORK],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
