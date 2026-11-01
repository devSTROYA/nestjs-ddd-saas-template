import fastifyHelmet from '@fastify/helmet';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

import type { AccentColor, ColorMode } from '@common/docs-theme';

import { mountApiDocs } from './api-docs.js';
import { API_PREFIX } from './api-prefix.js';

const REQUEST_ID_HEADER = 'x-request-id';

type ConfigureAppOptions = {
  docs: boolean;
  docsAccent?: AccentColor;
  docsColorMode?: ColorMode;
};

export async function configureApp(
  app: NestFastifyApplication,
  options: ConfigureAppOptions = { docs: true },
): Promise<void> {
  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onRequest', async (request, reply) => {
      void reply.header(REQUEST_ID_HEADER, request.id);
    });
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: options.docs ? false : undefined,
  });
  if (options.docs) {
    mountApiDocs(app, options.docsAccent, options.docsColorMode);
  }
}
