import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

import { DATABASE, type Database, DatabaseModule } from '../database/index.js';
import { PostgresThrottlerStorage } from './postgres-throttler-storage.js';
import { RATE_LIMITER, StorageRateLimiter } from './rate-limiter.js';

export const DEFAULT_RATE_LIMIT = { limit: 120, ttl: 60_000 } as const;

@Module({
  imports: [
    DatabaseModule,
    ThrottlerModule.forRootAsync({
      imports: [DatabaseModule],
      inject: [DATABASE],
      useFactory: (database: Database) => ({
        throttlers: [{ name: 'default', ...DEFAULT_RATE_LIMIT }],
        storage: new PostgresThrottlerStorage(database),
      }),
    }),
  ],
  providers: [
    {
      // Its own storage instance, not the one in ThrottlerModule: tests replace that one, and the
      // limiter needs `peek`, which the Throttler storage interface does not have.
      provide: RATE_LIMITER,
      inject: [DATABASE],
      useFactory: (database: Database): StorageRateLimiter =>
        new StorageRateLimiter(new PostgresThrottlerStorage(database)),
    },
  ],
  exports: [ThrottlerModule, RATE_LIMITER],
})
export class RateLimitModule {}
