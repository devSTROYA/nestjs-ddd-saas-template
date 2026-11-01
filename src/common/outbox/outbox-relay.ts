import {
  type BeforeApplicationShutdown,
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { and, asc, eq, isNull, lt } from 'drizzle-orm';

import { CLOCK, type Clock } from '@common/clock';
import { DATABASE_CONTEXT, type DatabaseContext } from '@common/database';
import type { Nullable } from '@common/types';

import {
  MAX_OUTBOX_ATTEMPTS,
  MAX_OUTBOX_BACKOFF_MS,
  MAX_OUTBOX_BATCHES_PER_RUN,
  MAX_OUTBOX_ERROR_LENGTH,
  OUTBOX_BATCH_SIZE,
  OUTBOX_CONSUMERS,
} from './outbox.constants.js';
import { outboxConfig } from './outbox.config.js';
import { type OutboxRow, outbox } from './outbox.schema.js';
import type { OutboxConsumer, StoredEvent } from './outbox-consumer.js';

type DrainResult = { delivered: number; failed: number };

// TODO: Row locks are held while consumers run and failed rows retry every tick with no backoff;
// claim rows first and add backoff before adding slow consumers.
@Injectable()
export class OutboxRelay implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly logger = new Logger(OutboxRelay.name);
  private timer: Nullable<NodeJS.Timeout> = null;
  private running: Promise<void> = Promise.resolve();
  private active = false;
  private stopping = false;
  private failures = 0;

  constructor(
    @Inject(DATABASE_CONTEXT) private readonly context: DatabaseContext,
    @Inject(OUTBOX_CONSUMERS) private readonly consumers: readonly OutboxConsumer[],
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(outboxConfig.KEY) private readonly config: ConfigType<typeof outboxConfig>,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.relayEnabled) {
      this.start();
    }
  }

  async beforeApplicationShutdown(): Promise<void> {
    this.active = false;
    this.stopping = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this.running;
  }

  start(): void {
    if (this.active) {
      return;
    }
    this.active = true;
    this.schedule();
  }

  drainAll(): Promise<void> {
    this.running = this.drainUntilIdle();
    return this.running;
  }

  drain(): Promise<DrainResult> {
    return this.context.run(async () => {
      const rows = await this.context.client
        .select()
        .from(outbox)
        .where(and(isNull(outbox.processedAt), lt(outbox.attempts, MAX_OUTBOX_ATTEMPTS)))
        .orderBy(asc(outbox.id))
        .limit(OUTBOX_BATCH_SIZE)
        .for('update', { skipLocked: true });
      let delivered = 0;
      for (const row of rows) {
        if (await this.deliver(row)) {
          delivered += 1;
        }
      }
      return { delivered, failed: rows.length - delivered };
    });
  }

  private async drainUntilIdle(): Promise<void> {
    for (let batch = 0; batch < MAX_OUTBOX_BATCHES_PER_RUN && !this.stopping; batch += 1) {
      const { delivered, failed } = await this.drain();
      if (failed > 0 || delivered < OUTBOX_BATCH_SIZE) {
        return;
      }
    }
  }

  private schedule(): void {
    if (!this.active) {
      return;
    }
    const base = this.config.pollIntervalMs;
    const interval = Math.min(base * 2 ** this.failures, Math.max(base, MAX_OUTBOX_BACKOFF_MS));
    this.timer = setTimeout(() => {
      this.running = this.tick();
    }, interval);
  }

  private async tick(): Promise<void> {
    try {
      await this.drainUntilIdle();
      if (this.failures > 0) {
        this.logger.log(`Outbox relay recovered after ${this.failures} failed batches`);
      }
      this.failures = 0;
    } catch (error) {
      this.logBatchFailure(error);
      this.failures += 1;
    } finally {
      this.schedule();
    }
  }

  private logBatchFailure(error: unknown): void {
    if (this.failures === 0) {
      this.logger.error(`Outbox batch failed, retrying with backoff: ${describe(error)}`);
      return;
    }
    this.logger.debug(`Outbox batch still failing: ${describe(error)}`);
  }

  private async deliver(row: OutboxRow): Promise<boolean> {
    const event: StoredEvent = {
      id: row.id,
      name: row.name,
      aggregateId: row.aggregateId,
      tenantId: row.tenantId,
      occurredAt: row.occurredAt,
      payload: row.payload,
    };
    try {
      for (const consumer of this.consumers) {
        await consumer.handle(event);
      }
    } catch (error) {
      await this.recordFailure(row, error);
      return false;
    }
    await this.context.client
      .update(outbox)
      .set({ processedAt: this.clock.now() })
      .where(eq(outbox.id, row.id));
    return true;
  }

  private async recordFailure(row: OutboxRow, error: unknown): Promise<void> {
    const attempts = row.attempts + 1;
    await this.context.client
      .update(outbox)
      .set({ attempts, lastError: describe(error).slice(0, MAX_OUTBOX_ERROR_LENGTH) })
      .where(eq(outbox.id, row.id));
    if (attempts >= MAX_OUTBOX_ATTEMPTS) {
      this.logger.error(`Outbox event ${row.id} (${row.name}) gave up after ${attempts} attempts`);
    }
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
