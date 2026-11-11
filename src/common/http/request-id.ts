import type { NodeRequest, NodeResponse } from '@nestjs/platform-node';

import { newUuidV7 } from '@common/primitives';

const REQUEST_ID_HEADER = 'x-request-id';

declare module '@nestjs/platform-node' {
  interface NodeRequest {
    id: string;
  }
}

// INFO: The only place a request id is generated; registered as the first middleware. It is stored as
// `request.id`, where pino-http picks it up instead of generating its own. An incoming x-request-id is never read.
export function assignRequestId(
  request: NodeRequest,
  response: NodeResponse,
  next: () => void,
): void {
  request.id = newUuidV7();
  response.setHeader(REQUEST_ID_HEADER, request.id);
  next();
}
