import { InvalidLoginChallengeStatusError } from '../errors/domain.error.js';

export const LoginChallengeStatus = {
  PENDING: 'pending',
  CONSUMED: 'consumed',
} as const;

export type LoginChallengeStatus = (typeof LoginChallengeStatus)[keyof typeof LoginChallengeStatus];

// Fails fast: an unknown stored value throws instead of becoming a status.
export function parseLoginChallengeStatus(value: string): LoginChallengeStatus {
  const status = Object.values(LoginChallengeStatus).find((candidate) => candidate === value);
  if (!status) {
    throw new InvalidLoginChallengeStatusError(value);
  }
  return status;
}
