import type { TenantId } from '@modules/tenants';
import type { UserId } from '@modules/users';
import type { WorkspaceId } from '@modules/workspaces';

import type { InvitationId } from '../../../domain/value-objects/invitation-id.js';

export class AcceptInvitationCommand {
  constructor(
    public readonly invitationId: InvitationId,
    public readonly otp: string,
    public readonly tenantName: string,
    public readonly userName: string,
  ) {}
}

export interface AcceptInvitationResult {
  tenantId: TenantId;
  userId: UserId;
  workspaceId: WorkspaceId;
}
