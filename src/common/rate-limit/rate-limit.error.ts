import { HttpStatus } from '@nestjs/common';

import { DomainError } from '../errors/domain-error.js';
import { RETRY_AFTER_DETAIL } from '../errors/error-status-registry.js';

export const RateLimitErrorCodes = {
  EXCEEDED: 'RATE_LIMIT_EXCEEDED',
} as const;

export type RateLimitErrorCode = (typeof RateLimitErrorCodes)[keyof typeof RateLimitErrorCodes];

export class RateLimitExceededError extends DomainError {
  constructor(retryAfterSeconds: number) {
    super(RateLimitErrorCodes.EXCEEDED, 'Too many requests', {
      [RETRY_AFTER_DETAIL]: retryAfterSeconds,
    });
  }
}

export const rateLimitErrorStatus = {
  [RateLimitErrorCodes.EXCEEDED]: HttpStatus.TOO_MANY_REQUESTS,
} as const satisfies Record<RateLimitErrorCode, number>;
