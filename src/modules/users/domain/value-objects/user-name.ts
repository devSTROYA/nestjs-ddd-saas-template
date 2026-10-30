import { EmptyNameError, UserNameTooLongError } from '../errors/domain.error.js';

export const MAX_USER_NAME_LENGTH = 255;

export class UserName {
  private constructor(public readonly value: string) {}

  static create(raw: string): UserName {
    const value = raw.trim();
    if (!value) {
      throw new EmptyNameError();
    }
    if (value.length > MAX_USER_NAME_LENGTH) {
      throw new UserNameTooLongError(MAX_USER_NAME_LENGTH);
    }
    return new UserName(value);
  }

  static restore(value: string): UserName {
    return new UserName(value);
  }

  equals(other: UserName): boolean {
    return this.value === other.value;
  }
}
