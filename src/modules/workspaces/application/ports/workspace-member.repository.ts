import type { Nullable } from '@common/types';
import type { TenantId } from '@modules/tenants';
import type { UserId } from '@modules/users';

import type { WorkspaceMember } from '../../domain/entities/workspace-member.js';
import type { WorkspaceId } from '../../domain/value-objects/workspace-id.js';

// INFO: Every membership change holds the workspace row lock (WorkspaceRepository.findByIdForUpdate), so the owner count cannot go stale.
export interface WorkspaceMemberRepository {
  findByUser(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    userId: UserId,
  ): Promise<Nullable<WorkspaceMember>>;
  countOwners(tenantId: TenantId, workspaceId: WorkspaceId): Promise<number>;
  save(member: WorkspaceMember): Promise<void>;
  delete(member: WorkspaceMember): Promise<void>;
}

export const WORKSPACE_MEMBER_REPOSITORY = Symbol('WORKSPACE_MEMBER_REPOSITORY');
