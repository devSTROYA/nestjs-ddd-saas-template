import type { NestNodeApplication } from '@nestjs/platform-node';
import helmet from 'helmet';

import type { AccentColor, ColorMode } from '@common/docs-theme';
import { assignRequestId } from '@common/http';

import { mountApiDocs } from './api-docs.js';
import { API_PREFIX } from './api-prefix.js';

type ConfigureAppOptions = {
  docs: boolean;
  docsAccent?: AccentColor;
  docsColorMode?: ColorMode;
};

export async function configureApp(
  app: NestNodeApplication,
  options: ConfigureAppOptions = { docs: true },
): Promise<void> {
  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();
  app.use(assignRequestId);
  app.use(helmet({ contentSecurityPolicy: options.docs ? false : undefined }));
  if (options.docs) {
    mountApiDocs(app, options.docsAccent, options.docsColorMode);
  }
}
