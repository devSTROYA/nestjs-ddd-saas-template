import { InvalidEmailError } from './primitive.error.js';

const MAX_LENGTH = 254;
const MAX_LOCAL_PART_LENGTH = 64;
const ATOM = "[a-z0-9!#$%&'*+/=?^_`{|}~-]+";
const LABEL = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
const PATTERN = new RegExp(`^${ATOM}(?:\\.${ATOM})*@${LABEL}(?:\\.${LABEL})+$`);

function isValid(value: string): boolean {
  return (
    value.length <= MAX_LENGTH && value.indexOf('@') <= MAX_LOCAL_PART_LENGTH && PATTERN.test(value)
  );
}

export class Email {
  private constructor(public readonly value: string) {}

  static create(raw: string): Email {
    const value = raw.trim().toLowerCase();
    if (!isValid(value)) {
      throw new InvalidEmailError(value);
    }
    return new Email(value);
  }

  static restore(value: string): Email {
    return new Email(value);
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}
