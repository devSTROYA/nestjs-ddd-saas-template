import {
  type BeforeApplicationShutdown,
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, asc, eq, isNull, lt } from 'drizzle-orm';

import { CLOCK, type Clock } from '@common/clock';
import type { Env } from '@common/config';
import { DATABASE_CONTEXT, type DatabaseContext } from '@common/database';
import type { Nullable } from '@common/types';

import {
  MAX_OUTBOX_ATTEMPTS,
  MAX_OUTBOX_BATCHES_PER_RUN,
  MAX_OUTBOX_ERROR_LENGTH,
  OUTBOX_BATCH_SIZE,
  OUTBOX_CONSUMERS,
} from './outbox.constants.js';
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

  constructor(
    @Inject(DATABASE_CONTEXT) private readonly context: DatabaseContext,
    @Inject(OUTBOX_CONSUMERS) private readonly consumers: readonly OutboxConsumer[],
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.get('OUTBOX_RELAY_ENABLED', { infer: true })) {
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
    const interval = this.config.get('OUTBOX_POLL_INTERVAL_MS', { infer: true });
    this.timer = setTimeout(() => {
      this.running = this.tick();
    }, interval);
  }

  private async tick(): Promise<void> {
    try {
      await this.drainUntilIdle();
    } catch (error) {
      this.logger.error(`Outbox batch failed: ${describe(error)}`);
    } finally {
      this.schedule();
    }
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
