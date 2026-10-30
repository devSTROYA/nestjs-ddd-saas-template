export const WorkspaceRole = {
  OWNER: 'owner',
  ADMIN: 'admin',
} as const;

export type WorkspaceRole = (typeof WorkspaceRole)[keyof typeof WorkspaceRole];

export function isWorkspaceRole(value: string): value is WorkspaceRole {
  return Object.values<string>(WorkspaceRole).includes(value);
}
