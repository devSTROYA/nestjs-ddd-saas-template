import type { TenantId } from '@modules/tenants';
import type { UserId } from '@modules/users';

export class RemoveWorkspaceMemberCommand {
  constructor(
    public readonly actorId: UserId,
    public readonly tenantId: TenantId,
    public readonly memberId: UserId,
  ) {}
}
