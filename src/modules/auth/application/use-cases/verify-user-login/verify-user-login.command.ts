export class VerifyUserLoginCommand {
  constructor(
    public readonly email: string,
    public readonly otp: string,
    public readonly ip: string,
  ) {}
}
