export const PrincipalType = {
  ADMIN: 'admin',
  USER: 'user',
} as const;

export type PrincipalType = (typeof PrincipalType)[keyof typeof PrincipalType];

export function isPrincipalType(value: string): value is PrincipalType {
  return Object.values<string>(PrincipalType).includes(value);
}

export interface Principal {
  type: PrincipalType;
  id: string;
  // Only users belong to a tenant; admins are platform operators.
  tenantId?: string;
}
