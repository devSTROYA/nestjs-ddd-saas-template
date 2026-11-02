import { InvalidWorkspaceRoleError } from '../errors/domain.error.js';

export const WorkspaceRole = {
  OWNER: 'owner',
  ADMIN: 'admin',
} as const;

export type WorkspaceRole = (typeof WorkspaceRole)[keyof typeof WorkspaceRole];

function isWorkspaceRole(value: string): value is WorkspaceRole {
  return Object.values<string>(WorkspaceRole).includes(value);
}

export function toWorkspaceRole(value: string): WorkspaceRole {
  if (!isWorkspaceRole(value)) {
    throw new InvalidWorkspaceRoleError(value);
  }
  return value;
}
