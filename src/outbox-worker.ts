import { NestFactory } from '@nestjs/core';

import { checkConfigOrExit } from '@common/config';
import { OutboxRelay } from '@common/outbox';

import { OUTBOX_WORKER_CONFIGS } from './config-sets.js';
import { OutboxWorkerModule } from './outbox-worker.module.js';
import { runEntrypoint } from './run-entrypoint.js';

const ONCE_FLAG = '--once';
const RELAY_ENABLED_ENV = 'OUTBOX_RELAY_ENABLED';

async function run(): Promise<void> {
  const once = process.argv.includes(ONCE_FLAG);
  if (once) {
    // INFO: The relay starts its own loop on bootstrap when enabled; a one-shot run must not.
    process.env[RELAY_ENABLED_ENV] = 'false';
  }
  checkConfigOrExit(OUTBOX_WORKER_CONFIGS);
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

await runEntrypoint('OutboxWorker', run);
