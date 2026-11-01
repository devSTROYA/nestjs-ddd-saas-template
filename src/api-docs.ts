import type { IncomingMessage, ServerResponse } from 'node:http';

import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { apiReference } from '@scalar/nestjs-api-reference';

import {
  type AccentColor,
  DEFAULT_ACCENT,
  buildDocsThemeCss,
  isAccentColor,
} from '@common/docs-theme';

import { apiDocument } from './openapi.js';

const DOCS_PATH = '/docs';
const DOCS_JSON_PATH = `${DOCS_PATH}/openapi.json`;
const DOCS_JSON_FILENAME = 'openapi.json';
const DOCS_THEME = 'kepler';
const ACCENT_QUERY_PARAM = 'accent';

// INFO: Scalar has no option for the "Show Schema" toggle of the response example card.
const HIDE_SHOW_SCHEMA_CSS = '.response-card .scalar-card-checkbox { display: none; }';

type DocsHandler = (request: IncomingMessage, response: ServerResponse) => void;

function createHandler(accent: AccentColor): DocsHandler {
  return apiReference({
    withFastify: true,
    theme: DOCS_THEME,
    content: apiDocument,
    agent: { disabled: true },
    showDeveloperTools: 'never',
    hideTestRequestButton: true,
    hideClientButton: true,
    customCss: `${buildDocsThemeCss(accent)}\n${HIDE_SHOW_SCHEMA_CSS}`,
  }) as unknown as DocsHandler;
}

export function mountApiDocs(
  app: NestFastifyApplication,
  defaultAccent: AccentColor = DEFAULT_ACCENT,
): void {
  const handlers = new Map<AccentColor, DocsHandler>();
  const handlerFor = (accent: AccentColor): DocsHandler => {
    const existing = handlers.get(accent);
    if (existing) {
      return existing;
    }
    const created = createHandler(accent);
    handlers.set(accent, created);
    return created;
  };

  app.use(DOCS_JSON_PATH, (_request: unknown, response: ServerResponse) => {
    response.setHeader('content-type', 'application/json');
    response.setHeader('content-disposition', `attachment; filename="${DOCS_JSON_FILENAME}"`);
    response.end(JSON.stringify(apiDocument));
  });
  app.use(DOCS_PATH, (request: IncomingMessage, response: ServerResponse) => {
    const requested = new URL(request.url ?? '/', 'http://localhost').searchParams.get(
      ACCENT_QUERY_PARAM,
    );
    const accent = requested !== null && isAccentColor(requested) ? requested : defaultAccent;
    handlerFor(accent)(request, response);
  });
}
