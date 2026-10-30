import { DomainError } from '@common/errors';

export const InvitationErrorCodes = {
  NOT_FOUND: 'INVITATION_NOT_FOUND',
  NOT_PENDING: 'INVITATION_NOT_PENDING',
  ALREADY_PENDING: 'INVITATION_ALREADY_PENDING',
  EMAIL_ALREADY_REGISTERED: 'INVITATION_EMAIL_ALREADY_REGISTERED',
  EXPIRED: 'INVITATION_EXPIRED',
  LOCKED: 'INVITATION_LOCKED',
  OTP_INVALID: 'INVITATION_OTP_INVALID',
  STATUS_INVALID: 'INVITATION_STATUS_INVALID',
} as const;

export type InvitationErrorCode = (typeof InvitationErrorCodes)[keyof typeof InvitationErrorCodes];

export class InvitationNotFoundError extends DomainError {
  constructor(id: string) {
    super(InvitationErrorCodes.NOT_FOUND, `Invitation not found: ${id}`);
  }
}

export class InvitationNotPendingError extends DomainError {
  constructor(status: string) {
    super(InvitationErrorCodes.NOT_PENDING, `Invitation is not pending, status: ${status}`);
  }
}

export class InvitationAlreadyPendingError extends DomainError {
  constructor(email: string) {
    super(InvitationErrorCodes.ALREADY_PENDING, `A pending invitation already exists for ${email}`);
  }
}

export class InvitationEmailAlreadyRegisteredError extends DomainError {
  constructor(email: string) {
    super(
      InvitationErrorCodes.EMAIL_ALREADY_REGISTERED,
      `${email} already belongs to a registered user`,
    );
  }
}

export class InvitationExpiredError extends DomainError {
  constructor() {
    super(InvitationErrorCodes.EXPIRED, 'Invitation has expired');
  }
}

export class InvitationLockedError extends DomainError {
  constructor() {
    super(InvitationErrorCodes.LOCKED, 'Too many OTP attempts, invitation is locked');
  }
}

export class InvalidOtpError extends DomainError {
  constructor() {
    super(InvitationErrorCodes.OTP_INVALID, 'Invalid OTP');
  }
}

export class InvalidInvitationStatusError extends DomainError {
  constructor(status: string) {
    super(InvitationErrorCodes.STATUS_INVALID, `Unknown invitation status: ${status}`);
  }
}
