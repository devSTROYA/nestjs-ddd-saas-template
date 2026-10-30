import { DomainError } from '@common/errors';

export const AuthErrorCodes = {
  UNAUTHENTICATED: 'AUTH_UNAUTHENTICATED',
  FORBIDDEN: 'AUTH_FORBIDDEN',
  CREDENTIALS_INVALID: 'AUTH_CREDENTIALS_INVALID',
  REFRESH_TOKEN_INVALID: 'AUTH_REFRESH_TOKEN_INVALID',
  CHALLENGE_ALREADY_PENDING: 'AUTH_CHALLENGE_ALREADY_PENDING',
  CHALLENGE_STATUS_INVALID: 'AUTH_CHALLENGE_STATUS_INVALID',
  PRINCIPAL_TYPE_INVALID: 'AUTH_PRINCIPAL_TYPE_INVALID',
} as const;

export type AuthErrorCode = (typeof AuthErrorCodes)[keyof typeof AuthErrorCodes];

export class UnauthenticatedError extends DomainError {
  constructor() {
    super(AuthErrorCodes.UNAUTHENTICATED, 'Authentication is required');
  }
}

export class ForbiddenError extends DomainError {
  constructor() {
    super(AuthErrorCodes.FORBIDDEN, 'The authenticated principal may not do this');
  }
}

export class InvalidCredentialsError extends DomainError {
  constructor() {
    super(AuthErrorCodes.CREDENTIALS_INVALID, 'Invalid email or one-time code');
  }
}

export class InvalidRefreshTokenError extends DomainError {
  constructor() {
    super(AuthErrorCodes.REFRESH_TOKEN_INVALID, 'Invalid refresh token');
  }
}

export class LoginChallengeAlreadyPendingError extends DomainError {
  constructor() {
    super(AuthErrorCodes.CHALLENGE_ALREADY_PENDING, 'A login challenge is already pending');
  }
}

export class InvalidLoginChallengeStatusError extends DomainError {
  constructor(status: string) {
    super(AuthErrorCodes.CHALLENGE_STATUS_INVALID, `Unknown login challenge status: ${status}`);
  }
}

export class InvalidPrincipalTypeError extends DomainError {
  constructor(type: string) {
    super(AuthErrorCodes.PRINCIPAL_TYPE_INVALID, `Unknown principal type: ${type}`);
  }
}
