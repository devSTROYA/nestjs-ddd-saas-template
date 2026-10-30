import fastifyHelmet from '@fastify/helmet';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

import type { AccentColor } from '@common/docs-theme';

import { mountApiDocs } from './api-docs.js';
import { API_PREFIX } from './api-prefix.js';

export interface ConfigureAppOptions {
  docs: boolean;
  docsAccent?: AccentColor;
}

export async function configureApp(
  app: NestFastifyApplication,
  options: ConfigureAppOptions = { docs: true },
): Promise<void> {
  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: options.docs ? false : undefined,
  });
  if (options.docs) {
    mountApiDocs(app, options.docsAccent);
  }
}
