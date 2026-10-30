import { DomainError } from '@common/errors';

export const AdminErrorCodes = {
  EMAIL_TAKEN: 'ADMIN_EMAIL_TAKEN',
} as const;

export type AdminErrorCode = (typeof AdminErrorCodes)[keyof typeof AdminErrorCodes];

export class AdminEmailAlreadyTakenError extends DomainError {
  constructor(email: string) {
    super(AdminErrorCodes.EMAIL_TAKEN, `Admin email already taken: ${email}`);
  }
}
