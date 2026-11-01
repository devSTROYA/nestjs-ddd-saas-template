import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ClockModule } from '@common/clock';
import { DatabaseModule } from '@common/database';

import { LoggingOutboxConsumer } from './logging-outbox-consumer.js';
import { outboxConfig } from './outbox.config.js';
import { OUTBOX_CONSUMERS } from './outbox.constants.js';
import { OutboxRelay } from './outbox-relay.js';

@Module({
  imports: [ConfigModule.forFeature(outboxConfig), ClockModule, DatabaseModule],
  providers: [
    LoggingOutboxConsumer,
    {
      provide: OUTBOX_CONSUMERS,
      inject: [LoggingOutboxConsumer],
      useFactory: (logging: LoggingOutboxConsumer) => [logging],
    },
    OutboxRelay,
  ],
  exports: [OutboxRelay],
})
export class OutboxModule {}
