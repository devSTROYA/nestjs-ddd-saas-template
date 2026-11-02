export const WorkspacePermission = {
  MEMBER_ADD: 'workspace-member:add',
  MEMBER_CHANGE_ROLE: 'workspace-member:change-role',
  MEMBER_REMOVE: 'workspace-member:remove',
  ROLE_MANAGE: 'workspace-role:manage',
} as const;

export type WorkspacePermission = (typeof WorkspacePermission)[keyof typeof WorkspacePermission];

export const ALL_WORKSPACE_PERMISSIONS = Object.values(WorkspacePermission);
