export class InviteTenantCommand {
  constructor(
    public readonly adminId: string,
    public readonly email: string,
  ) {}
}
