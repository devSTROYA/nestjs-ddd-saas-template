import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
  Inject,
  Logger,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import { DomainError } from './domain-error.js';
import {
  ERROR_STATUS_REGISTRY,
  INTERNAL_ERROR_CODE,
  RETRY_AFTER_DETAIL,
  type ErrorStatusRegistry,
} from './error-status-registry.js';

@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter<DomainError> {
  private readonly logger = new Logger(DomainErrorFilter.name);

  constructor(
    @Inject(ERROR_STATUS_REGISTRY)
    private readonly registry: ErrorStatusRegistry,
  ) {}

  catch(error: DomainError, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    const status = this.registry[error.code];

    if (status === undefined) {
      this.logger.error(`Unmapped error code ${error.code}`, error.stack);
      void reply
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .send({ error: { code: INTERNAL_ERROR_CODE } });
      return;
    }
    const retryAfter = error.details?.[RETRY_AFTER_DETAIL];
    if (typeof retryAfter === 'number') {
      void reply.header('retry-after', retryAfter);
    }
    void reply.status(status).send({ error: { code: error.code, ...error.details } });
  }
}
