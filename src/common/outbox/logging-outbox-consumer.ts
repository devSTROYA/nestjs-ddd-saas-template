import { Injectable, Logger } from '@nestjs/common';

import type { OutboxConsumer, StoredEvent } from './outbox-consumer.js';

@Injectable()
export class LoggingOutboxConsumer implements OutboxConsumer {
  private readonly logger = new Logger(LoggingOutboxConsumer.name);

  handle(event: StoredEvent): Promise<void> {
    this.logger.log(`${event.name} aggregate=${event.aggregateId} event=${event.id}`);
    return Promise.resolve();
  }
}
