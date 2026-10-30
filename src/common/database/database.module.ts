import { Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import type { Env } from '../config/index.js';
import { DATABASE, DATABASE_CONTEXT, type Database, DatabaseContext } from './database-context.js';

import { UNIT_OF_WORK } from './unit-of-work.js';

const PG_POOL = Symbol('PG_POOL');

@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): Pool =>
        new Pool({
          connectionString: config.get('DATABASE_URL', { infer: true }),
          max: config.get('DATABASE_POOL_MAX', { infer: true }),
        }),
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
