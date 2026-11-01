import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { appConfig, checkConfigOrExit, docsConfig } from '@common/config';
import { generateRequestId, trustProxy } from '@common/http';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { APP_CONFIGS } from './config-sets.js';
import { configureApp } from './configure-app.js';
import { runEntrypoint } from './run-entrypoint.js';

const ALL_INTERFACES = '0.0.0.0';

async function bootstrap(): Promise<void> {
  // INFO: AppModule's ConfigModule.forRoot loaded the .env files at import time, so the factories can run before the app exists.
  checkConfigOrExit(APP_CONFIGS);
  const { trustProxyHops } = appConfig();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      trustProxy: trustProxy(trustProxyHops),
      genReqId: generateRequestId,
    }),
    { bufferLogs: true },
  );
  app.useLogger(app.get(Logger));
  const { nodeEnv, port } = app.get(appConfig.KEY, { strict: false });
  const docs = app.get(docsConfig.KEY, { strict: false });
  await configureApp(app, {
    docs: nodeEnv !== 'production',
    docsAccent: docs.accent,
    docsColorMode: docs.colorMode,
  });
  await app.listen(port, ALL_INTERFACES);
}
await runEntrypoint('Bootstrap', bootstrap);
