export abstract class Entity<Props extends object, Id extends string> {
  protected constructor(
    protected readonly props: Props,
    public readonly id: Id,
  ) {}
}
