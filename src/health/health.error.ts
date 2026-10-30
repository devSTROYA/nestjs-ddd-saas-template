import { HttpStatus } from '@nestjs/common';

import { DomainError } from '@common/errors';

export const HealthErrorCodes = {
  NOT_READY: 'HEALTH_NOT_READY',
} as const;

export type HealthErrorCode = (typeof HealthErrorCodes)[keyof typeof HealthErrorCodes];

export class NotReadyError extends DomainError {
  constructor() {
    super(HealthErrorCodes.NOT_READY, 'The service cannot reach its dependencies');
  }
}

export const healthErrorStatus = {
  [HealthErrorCodes.NOT_READY]: HttpStatus.SERVICE_UNAVAILABLE,
} as const satisfies Record<HealthErrorCode, number>;
