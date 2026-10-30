import { v7, validate, version } from 'uuid';

import { InvalidIdError } from './primitive.error.js';

const UUID_VERSION = 7;

export function newUuidV7(): string {
  return v7();
}

export function parseUuidV7(value: string): string {
  if (!validate(value) || version(value) !== UUID_VERSION) {
    throw new InvalidIdError(value);
  }
  return value;
}
