import type { IncomingMessage } from 'node:http';
import type { Http2ServerRequest } from 'node:http2';

import { newUuidV7 } from '@common/primitives';

// INFO: The only place a request id is generated. Fastify uses the return value as `request.id`;
// it is also set on the raw request, where pino-http picks it up instead of generating its own.
// An incoming x-request-id is never read.
export function generateRequestId(raw: IncomingMessage | Http2ServerRequest): string {
  const id = newUuidV7();
  Object.assign(raw, { id });
  return id;
}
