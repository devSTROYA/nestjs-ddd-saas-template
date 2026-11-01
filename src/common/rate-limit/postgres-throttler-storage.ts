import { Logger } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface.js';
import { sql } from 'drizzle-orm';

import type { Database } from '../database/database-context.js';

const CLEANUP_EVERY_HITS = 200;
const CLEANUP_GRACE_INTERVAL = '1 hour';

const ALLOWED_RECORD: ThrottlerStorageRecord = {
  totalHits: 0,
  timeToExpire: 0,
  isBlocked: false,
  timeToBlockExpire: 0,
};

export class PostgresThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(PostgresThrottlerStorage.name);
  private hits = 0;

  constructor(private readonly database: Database) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    _blockDuration: number,
    _throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    try {
      const { rows } = await this.database.execute<{ hits: number; seconds_left: number }>(sql`
        INSERT INTO rate_limits AS r (key, hits, expires_at)
        VALUES (${key}, 1, now() + ${ttl}::double precision * interval '1 millisecond')
        ON CONFLICT (key) DO UPDATE SET
          hits = CASE WHEN r.expires_at <= now() THEN 1 ELSE r.hits + 1 END,
          expires_at = CASE
            WHEN r.expires_at <= now()
            THEN now() + ${ttl}::double precision * interval '1 millisecond'
            ELSE r.expires_at
          END
        RETURNING
          hits,
          GREATEST(1, CEIL(EXTRACT(EPOCH FROM (expires_at - now()))))::int AS seconds_left`);
      const row = rows[0];
      if (!row) {
        return ALLOWED_RECORD;
      }
      this.cleanUpSometimes();
      const isBlocked = row.hits > limit;
      return {
        totalHits: row.hits,
        timeToExpire: row.seconds_left,
        isBlocked,
        timeToBlockExpire: isBlocked ? row.seconds_left : 0,
      };
    } catch (error) {
      this.logger.warn(`Rate limit storage unavailable, allowing the request: ${String(error)}`);
      return ALLOWED_RECORD;
    }
  }

  // INFO: Fails open like `increment`: an unreachable database reads as "no hits".
  async peek(key: string): Promise<{ hits: number; secondsLeft: number }> {
    try {
      const { rows } = await this.database.execute<{ hits: number; seconds_left: number }>(sql`
        SELECT hits, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (expires_at - now()))))::int AS seconds_left
        FROM rate_limits WHERE key = ${key} AND expires_at > now()`);
      const row = rows[0];
      return row ? { hits: row.hits, secondsLeft: row.seconds_left } : { hits: 0, secondsLeft: 0 };
    } catch (error) {
      this.logger.warn(`Rate limit storage unavailable, allowing the request: ${String(error)}`);
      return { hits: 0, secondsLeft: 0 };
    }
  }

  private cleanUpSometimes(): void {
    this.hits += 1;
    if (this.hits % CLEANUP_EVERY_HITS !== 0) {
      return;
    }
    this.database
      .execute(
        sql`DELETE FROM rate_limits WHERE expires_at < now() - ${CLEANUP_GRACE_INTERVAL}::interval`,
      )
      .catch((error: unknown) => {
        this.logger.warn(`Rate limit cleanup failed: ${String(error)}`);
      });
  }
}
