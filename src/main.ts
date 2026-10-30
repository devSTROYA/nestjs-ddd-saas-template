import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import type { Env } from '@common/config';
import { validateEnv } from '@common/config';
import { trustProxy } from '@common/http';
import { AppModule } from './app.module.js';
import { configureApp } from './configure-app.js';

const ALL_INTERFACES = '0.0.0.0';

async function bootstrap() {
  const { TRUST_PROXY_HOPS } = validateEnv(process.env);
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: trustProxy(TRUST_PROXY_HOPS) }),
  );
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  await configureApp(app, {
    docs: config.get('NODE_ENV', { infer: true }) !== 'production',
    docsAccent: config.get('DOCS_ACCENT', { infer: true }),
  });
  await app.listen(config.get('PORT', { infer: true }), ALL_INTERFACES);
}
await bootstrap();
