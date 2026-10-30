import { HttpStatus } from '@nestjs/common';

import { DomainError } from '../errors/domain-error.js';

export const ValidationErrorCodes = {
  INPUT_INVALID: 'INPUT_INVALID',
} as const;

export type ValidationErrorCode = (typeof ValidationErrorCodes)[keyof typeof ValidationErrorCodes];

export interface InvalidField {
  path: string;
  code: string;
}

export class InputInvalidError extends DomainError {
  constructor(fields: readonly InvalidField[]) {
    super(ValidationErrorCodes.INPUT_INVALID, 'Invalid input', { fields });
  }
}

export const validationErrorStatus = {
  [ValidationErrorCodes.INPUT_INVALID]: HttpStatus.UNPROCESSABLE_ENTITY,
} as const satisfies Record<ValidationErrorCode, number>;
