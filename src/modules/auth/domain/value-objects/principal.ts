import { InvalidPrincipalTypeError } from '../errors/domain.error.js';

export const PrincipalType = {
  ADMIN: 'admin',
  USER: 'user',
} as const;

export type PrincipalType = (typeof PrincipalType)[keyof typeof PrincipalType];

// INFO: A boolean for untrusted token claims, where a bad type means "no principal", not an error.
export function isPrincipalType(value: string): value is PrincipalType {
  return Object.values<string>(PrincipalType).includes(value);
}

// Fails fast: an unknown stored value throws instead of becoming a principal type.
export function parsePrincipalType(value: string): PrincipalType {
  if (!isPrincipalType(value)) {
    throw new InvalidPrincipalTypeError(value);
  }
  return value;
}

export type Principal = {
  type: PrincipalType;
  id: string;
  tenantId?: string;
};
