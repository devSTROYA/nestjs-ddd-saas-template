import type { AdminId } from '@modules/admins';

export class InviteTenantCommand {
  constructor(
    public readonly adminId: AdminId,
    public readonly email: string,
  ) {}
}
