import { WorkspaceRoleId } from './workspace-role-id.js';

// INFO: Rows seeded by migration 0013 with these fixed ids; their permissions live only there.
export const SystemRoleId = {
  OWNER: WorkspaceRoleId.restore('00000000-0000-7000-8000-000000000001'),
  ADMIN: WorkspaceRoleId.restore('00000000-0000-7000-8000-000000000002'),
  MEMBER: WorkspaceRoleId.restore('00000000-0000-7000-8000-000000000003'),
} as const;

export const SYSTEM_ROLE_KEYS: readonly string[] = ['owner', 'admin', 'member'];
