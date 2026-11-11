import { Module } from '@nestjs/common';
import { ConfigModule, type ConfigType } from '@nestjs/config';
import { DrizzleModule, getDrizzleToken } from '@nestjs/drizzle';
import { drizzle } from 'drizzle-orm/node-postgres';

import { DATABASE, DATABASE_CONTEXT, type Database, DatabaseContext } from './database-context.js';
import { databaseConfig } from './database.config.js';
import { UNIT_OF_WORK } from './unit-of-work.js';

@Module({
  imports: [
    // Owns the pg pool: creates it per application and closes it on shutdown.
    DrizzleModule.forRootAsync<typeof drizzle>({
      imports: [ConfigModule.forFeature(databaseConfig)],
      inject: [databaseConfig.KEY],
      useFactory: (config: ConfigType<typeof databaseConfig>) => ({
        drizzle,
        connection: { connectionString: config.url, max: config.poolMax },
      }),
    }),
  ],
  providers: [
    { provide: DATABASE, useExisting: getDrizzleToken() },
    {
      provide: DATABASE_CONTEXT,
      inject: [DATABASE],
      useFactory: (database: Database): DatabaseContext => new DatabaseContext(database),
    },
    { provide: UNIT_OF_WORK, useExisting: DATABASE_CONTEXT },
  ],
  exports: [DATABASE, DATABASE_CONTEXT, UNIT_OF_WORK],
})
export class DatabaseModule {}
