import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { Env } from '@common/config';
import { ADMIN_REPOSITORY, type AdminRepository, seedAdmin } from '@modules/admins';
import { AppModule } from './app.module.js';

async function seed(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const email = app.get<ConfigService<Env, true>>(ConfigService).get('ADMIN_SEED_EMAIL', {
      infer: true,
    });
    if (!email) {
      throw new Error('ADMIN_SEED_EMAIL is required to seed the first admin');
    }
    const result = await seedAdmin(app.get<AdminRepository>(ADMIN_REPOSITORY), email);
    new Logger('Seed').log(`Admin ${email}: ${result}`);
  } finally {
    await app.close();
  }
}

await seed();
