import { DomainError } from '@common/errors';

export const UserErrorCodes = {
  NAME_EMPTY: 'USER_NAME_EMPTY',
  NAME_TOO_LONG: 'USER_NAME_TOO_LONG',
  EMAIL_TAKEN: 'USER_EMAIL_TAKEN',
  ID_CONFLICT: 'USER_ID_CONFLICT',
} as const;

export type UserErrorCode = (typeof UserErrorCodes)[keyof typeof UserErrorCodes];

export class EmptyNameError extends DomainError {
  constructor() {
    super(UserErrorCodes.NAME_EMPTY, 'Name is required');
  }
}

export class UserNameTooLongError extends DomainError {
  constructor(maxLength: number) {
    super(UserErrorCodes.NAME_TOO_LONG, `Name must be at most ${maxLength} characters`);
  }
}

export class EmailAlreadyTakenError extends DomainError {
  constructor(email: string) {
    super(UserErrorCodes.EMAIL_TAKEN, `Email already taken: ${email}`);
  }
}

export class UserIdConflictError extends DomainError {
  constructor(id: string) {
    super(UserErrorCodes.ID_CONFLICT, `User id already exists in another tenant: ${id}`);
  }
}
