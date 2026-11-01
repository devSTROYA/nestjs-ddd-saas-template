import { NestFactory } from '@nestjs/core';

import { OutboxRelay } from '@common/outbox';

import { OutboxWorkerModule } from './outbox-worker.module.js';

const ONCE_FLAG = '--once';
const RELAY_ENABLED_ENV = 'OUTBOX_RELAY_ENABLED';

async function run(): Promise<void> {
  const once = process.argv.includes(ONCE_FLAG);
  if (once) {
    // INFO: The relay starts its own loop on bootstrap when enabled; a one-shot run must not.
    process.env[RELAY_ENABLED_ENV] = 'false';
  }
  const app = await NestFactory.createApplicationContext(OutboxWorkerModule);
  app.enableShutdownHooks();
  const relay = app.get(OutboxRelay);
  if (once) {
    await relay.drainAll();
    await app.close();
    return;
  }
  relay.start();
}

await run();
