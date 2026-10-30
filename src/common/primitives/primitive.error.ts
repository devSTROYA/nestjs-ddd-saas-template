import { DomainError } from '../errors/domain-error.js';

export const PrimitiveErrorCodes = {
  EMAIL_INVALID: 'EMAIL_INVALID',
  ID_INVALID: 'ID_INVALID',
} as const;

export type PrimitiveErrorCode = (typeof PrimitiveErrorCodes)[keyof typeof PrimitiveErrorCodes];

export class InvalidEmailError extends DomainError {
  constructor(email: string) {
    super(PrimitiveErrorCodes.EMAIL_INVALID, `Invalid email: ${email}`);
  }
}

export class InvalidIdError extends DomainError {
  constructor(value: string) {
    super(PrimitiveErrorCodes.ID_INVALID, `Invalid id, expected a UUID v7: ${value}`);
  }
}
