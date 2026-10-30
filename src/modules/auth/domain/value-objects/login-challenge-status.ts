export const LoginChallengeStatus = {
  PENDING: 'pending',
  CONSUMED: 'consumed',
} as const;

export type LoginChallengeStatus = (typeof LoginChallengeStatus)[keyof typeof LoginChallengeStatus];

export function isLoginChallengeStatus(value: string): value is LoginChallengeStatus {
  return Object.values<string>(LoginChallengeStatus).includes(value);
}
