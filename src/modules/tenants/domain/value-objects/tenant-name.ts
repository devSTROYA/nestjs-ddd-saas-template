import { EmptyTenantNameError, TenantNameTooLongError } from '../errors/domain.error.js';

export const MAX_TENANT_NAME_LENGTH = 255;

export class TenantName {
  private constructor(public readonly value: string) {}

  static create(raw: string): TenantName {
    const value = raw.trim();
    if (!value) {
      throw new EmptyTenantNameError();
    }
    if (value.length > MAX_TENANT_NAME_LENGTH) {
      throw new TenantNameTooLongError(MAX_TENANT_NAME_LENGTH);
    }
    return new TenantName(value);
  }

  static restore(value: string): TenantName {
    return new TenantName(value);
  }

  equals(other: TenantName): boolean {
    return this.value === other.value;
  }
}
