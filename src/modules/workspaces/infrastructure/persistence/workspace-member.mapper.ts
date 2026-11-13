import { TenantId } from '@modules/tenants';
import { UserId } from '@modules/users';

import { WorkspaceMember } from '../../domain/entities/workspace-member.js';
import { WorkspaceId } from '../../domain/value-objects/workspace-id.js';
import { WorkspaceMemberId } from '../../domain/value-objects/workspace-member-id.js';
import { WorkspaceRoleId } from '../../domain/value-objects/workspace-role-id.js';
import type { WorkspaceMemberNewRow, WorkspaceMemberRow } from './workspace-member.schema.js';

export function toDomain(row: WorkspaceMemberRow): WorkspaceMember {
  return WorkspaceMember.rehydrate(
    {
      tenantId: TenantId.rehydrate(row.tenantId),
      workspaceId: WorkspaceId.rehydrate(row.workspaceId),
      userId: UserId.rehydrate(row.userId),
      roleId: WorkspaceRoleId.rehydrate(row.roleId),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    },
    WorkspaceMemberId.rehydrate(row.id),
  );
}

export function toPersistence(member: WorkspaceMember): WorkspaceMemberNewRow {
  return {
    id: member.id,
    tenantId: member.tenantId,
    workspaceId: member.workspaceId,
    userId: member.userId,
    createdAt: member.createdAt,
    ...toMutableColumns(member),
  };
}

// Columns an upsert may overwrite; id, tenant, workspace, user and createdAt stay as first written.
export function toMutableColumns(
  member: WorkspaceMember,
): Pick<WorkspaceMemberNewRow, 'roleId' | 'updatedAt'> {
  return { roleId: member.roleId, updatedAt: member.updatedAt };
}
