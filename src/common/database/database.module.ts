import { Inject, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigModule, type ConfigType } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { DATABASE, DATABASE_CONTEXT, type Database, DatabaseContext } from './database-context.js';
import { databaseConfig } from './database.config.js';
import { UNIT_OF_WORK } from './unit-of-work.js';

const PG_POOL = Symbol('PG_POOL');

const CONNECTION_TIMEOUT_MS = 5_000;
const STATEMENT_TIMEOUT_MS = 10_000;
// INFO: Longer than the statement timeout: Postgres cancels slow queries, this one covers a dead network.
const QUERY_TIMEOUT_MS = 12_000;

function createPool(config: ConfigType<typeof databaseConfig>): Pool {
  const logger = new Logger('DatabasePool');
  const pool = new Pool({
    connectionString: config.url,
    max: config.poolMax,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    statement_timeout: STATEMENT_TIMEOUT_MS,
    query_timeout: QUERY_TIMEOUT_MS,
  });
  // INFO: An 'error' event nobody listens to kills the process. pg-pool only listens to idle clients,
  // so a client held by a transaction needs its own listener; this one also logs the idle case.
  pool.on('connect', (client) => {
    client.on('error', (error) => {
      logger.error(`Database connection lost: ${error.message}`);
    });
  });
  pool.on('error', () => undefined);
  return pool;
}

@Module({
  imports: [ConfigModule.forFeature(databaseConfig)],
  providers: [
    {
      provide: PG_POOL,
      inject: [databaseConfig.KEY],
      useFactory: createPool,
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
