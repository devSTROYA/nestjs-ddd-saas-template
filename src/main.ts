import { NestFactory } from '@nestjs/core';
import { NodeAdapter, type NestNodeApplication } from '@nestjs/platform-node';
import { appConfig, checkConfigOrExit, docsConfig } from '@common/config';
import { trustProxy } from '@common/http';
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
  const app = await NestFactory.create<NestNodeApplication>(
    AppModule,
    new NodeAdapter({ trustProxy: trustProxy(trustProxyHops) }),
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
