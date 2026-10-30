import { DomainError } from '@common/errors';

export const TenantErrorCodes = {
  NAME_EMPTY: 'TENANT_NAME_EMPTY',
  NAME_TOO_LONG: 'TENANT_NAME_TOO_LONG',
} as const;

export type TenantErrorCode = (typeof TenantErrorCodes)[keyof typeof TenantErrorCodes];

export class EmptyTenantNameError extends DomainError {
  constructor() {
    super(TenantErrorCodes.NAME_EMPTY, 'Tenant name is required');
  }
}

export class TenantNameTooLongError extends DomainError {
  constructor(maxLength: number) {
    super(TenantErrorCodes.NAME_TOO_LONG, `Tenant name must be at most ${maxLength} characters`);
  }
}
