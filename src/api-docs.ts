import type { IncomingMessage, ServerResponse } from 'node:http';

import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { apiReference } from '@scalar/nestjs-api-reference';

import {
  type AccentColor,
  ColorMode,
  DEFAULT_ACCENT,
  DEFAULT_COLOR_MODE,
  buildDocsThemeCss,
  isAccentColor,
  isColorMode,
} from '@common/docs-theme';

import { apiDocument } from './openapi.js';

const DOCS_PATH = '/docs';
const DOCS_JSON_PATH = `${DOCS_PATH}/openapi.json`;
const DOCS_JSON_FILENAME = 'openapi.json';
const DOCS_THEME = 'kepler';
const ACCENT_QUERY_PARAM = 'accent';
const MODE_QUERY_PARAM = 'mode';

// INFO: Scalar has no option for the "Show Schema" toggle of the response example card.
const HIDE_SHOW_SCHEMA_CSS = '.response-card .scalar-card-checkbox { display: none; }';

type DocsHandler = (request: IncomingMessage, response: ServerResponse) => void;

const CLEAR_STORED_COLOR_MODE_SCRIPT =
  "<script>try{localStorage.removeItem('colorMode')}catch{}</script>";
const BODY_END = '</body>';

// INFO: Scalar prefers a stored toggle choice over the OS theme; system mode drops it so Scalar follows the OS live.
function injectClearStoredColorMode(response: ServerResponse): void {
  const write = response.write.bind(response) as (chunk: string) => boolean;
  response.write = ((chunk: string | Buffer): boolean => {
    const html = chunk.toString();
    return write(html.replace(BODY_END, () => `${CLEAR_STORED_COLOR_MODE_SCRIPT}${BODY_END}`));
  }) as ServerResponse['write'];
}

function createHandler(accent: AccentColor, mode: ColorMode): DocsHandler {
  return apiReference({
    ...(mode === ColorMode.system ? { hideDarkModeToggle: true } : {}),
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
  defaultMode: ColorMode = DEFAULT_COLOR_MODE,
): void {
  const handlers = new Map<string, DocsHandler>();
  const handlerFor = (accent: AccentColor, mode: ColorMode): DocsHandler => {
    const key = `${accent}:${mode}`;
    const existing = handlers.get(key);
    if (existing) {
      return existing;
    }
    const created = createHandler(accent, mode);
    handlers.set(key, created);
    return created;
  };

  app.use(DOCS_JSON_PATH, (_request: unknown, response: ServerResponse) => {
    response.setHeader('content-type', 'application/json');
    response.setHeader('content-disposition', `attachment; filename="${DOCS_JSON_FILENAME}"`);
    response.end(JSON.stringify(apiDocument));
  });
  app.use(DOCS_PATH, (request: IncomingMessage, response: ServerResponse) => {
    const params = new URL(request.url ?? '/', 'http://localhost').searchParams;
    const requestedAccent = params.get(ACCENT_QUERY_PARAM);
    const requestedMode = params.get(MODE_QUERY_PARAM);
    const accent =
      requestedAccent !== null && isAccentColor(requestedAccent) ? requestedAccent : defaultAccent;
    const mode = requestedMode !== null && isColorMode(requestedMode) ? requestedMode : defaultMode;
    if (mode === ColorMode.system) {
      injectClearStoredColorMode(response);
    }
    handlerFor(accent, mode)(request, response);
  });
}
