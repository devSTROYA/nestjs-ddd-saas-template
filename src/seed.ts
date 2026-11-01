import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { CLOCK, type Clock } from '@common/clock';
import { checkConfigOrExit } from '@common/config';
import { ADMIN_REPOSITORY, type AdminRepository, adminsConfig, seedAdmin } from '@modules/admins';
import { AppModule } from './app.module.js';
import { APP_CONFIGS } from './config-sets.js';
import { runEntrypoint } from './run-entrypoint.js';

async function seed(): Promise<void> {
  checkConfigOrExit(APP_CONFIGS);
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const { seedEmail: email } = app.get(adminsConfig.KEY, { strict: false });
    if (!email) {
      throw new Error('ADMIN_SEED_EMAIL is required to seed the first admin');
    }
    const result = await seedAdmin(
      app.get<AdminRepository>(ADMIN_REPOSITORY),
      email,
      app.get<Clock>(CLOCK).now(),
    );
    new Logger('Seed').log(`Admin ${email}: ${result}`);
  } finally {
    await app.close();
  }
}

await runEntrypoint('Seed', seed);
