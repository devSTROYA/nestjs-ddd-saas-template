import type { TenantId } from '@modules/tenants';
import type { UserId } from '@modules/users';
import type { WorkspaceId } from '@modules/workspaces';

export class AcceptInvitationCommand {
  constructor(
    public readonly invitationId: string,
    public readonly otp: string,
    public readonly tenantName: string,
    public readonly userName: string,
  ) {}
}

export type AcceptInvitationResult = {
  tenantId: TenantId;
  userId: UserId;
  workspaceId: WorkspaceId;
};
