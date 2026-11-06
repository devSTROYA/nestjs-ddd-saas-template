import type { DatabaseContext } from '@common/database';
import type { Nullable } from '@common/types';
import type { TenantId } from '@modules/tenants';
import type { UserId } from '@modules/users';

import type {
  WorkspaceMemberQuery,
  WorkspaceMemberListItem,
} from '../../application/ports/workspace-member.query.js';
import type { WorkspaceId } from '../../domain/value-objects/workspace-id.js';
import { findMemberPage, isMember } from './workspace-member-page.js';

export class DrizzleWorkspaceMemberQuery implements WorkspaceMemberQuery {
  constructor(private readonly context: DatabaseContext) {}

  async list(params: {
    tenantId: TenantId;
    workspaceId: WorkspaceId;
    actorId: UserId;
    page: number;
    limit: number;
  }): Promise<Nullable<{ items: WorkspaceMemberListItem[]; total: number }>> {
    if (!(await isMember(this.context, params.tenantId, params.workspaceId, params.actorId))) {
      return null;
    }
    return findMemberPage(
      this.context,
      params.workspaceId,
      params.limit,
      (params.page - 1) * params.limit,
    );
  }
}
