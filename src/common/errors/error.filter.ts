import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { DomainError } from './domain-error.js';
import {
  ERROR_STATUS_REGISTRY,
  INTERNAL_ERROR_CODE,
  RETRY_AFTER_DETAIL,
  type ErrorStatusRegistry,
} from './error-status-registry.js';

const REQUEST_INVALID_CODE = 'REQUEST_INVALID';
const MIN_CLIENT_ERROR = 400;
const MAX_CLIENT_ERROR = 499;

const CLIENT_ERROR_CODES: Readonly<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.METHOD_NOT_ALLOWED]: 'METHOD_NOT_ALLOWED',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'UNSUPPORTED_MEDIA_TYPE',
};

function clientErrorStatus(error: unknown): number | undefined {
  const status =
    error instanceof HttpException
      ? error.getStatus()
      : typeof error === 'object' && error !== null && 'statusCode' in error
        ? error.statusCode
        : undefined;
  return typeof status === 'number' && status >= MIN_CLIENT_ERROR && status <= MAX_CLIENT_ERROR
    ? status
    : undefined;
}

@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ErrorFilter.name);

  constructor(
    @Inject(ERROR_STATUS_REGISTRY)
    private readonly registry: ErrorStatusRegistry,
  ) {}

  catch(error: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const reply = http.getResponse<FastifyReply>();
    const requestId = http.getRequest<FastifyRequest>().id;

    if (error instanceof DomainError) {
      this.replyDomainError(error, reply, requestId);
      return;
    }
    const status = clientErrorStatus(error);
    if (status !== undefined) {
      void reply.status(status).send({
        error: { code: CLIENT_ERROR_CODES[status] ?? REQUEST_INVALID_CODE },
        requestId,
      });
      return;
    }
    this.replyInternal(error instanceof Error ? error.stack : undefined, reply, requestId);
  }

  private replyDomainError(error: DomainError, reply: FastifyReply, requestId: string): void {
    const status = this.registry[error.code];
    if (status === undefined) {
      this.replyInternal(error.stack, reply, requestId, `Unmapped error code ${error.code}`);
      return;
    }
    const retryAfter = error.details?.[RETRY_AFTER_DETAIL];
    if (typeof retryAfter === 'number') {
      void reply.header('retry-after', retryAfter);
    }
    void reply.status(status).send({ error: { code: error.code, ...error.details }, requestId });
  }

  private replyInternal(
    stack: string | undefined,
    reply: FastifyReply,
    requestId: string,
    message = 'Unhandled error',
  ): void {
    this.logger.error(message, stack);
    void reply
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .send({ error: { code: INTERNAL_ERROR_CODE }, requestId });
  }
}
