import type { UuidV7Id } from '@common/primitives';

export abstract class Entity<Props extends object, Id extends UuidV7Id> {
  protected constructor(
    protected readonly props: Props,
    public readonly id: Id,
  ) {}
}
