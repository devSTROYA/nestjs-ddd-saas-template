import { newUuidV7 } from '@common/primitives';
import type { Nullable } from '@common/types';

// Subclasses add primitive fields only (ids as strings, dates as ISO strings): the whole event is
// serialised to the outbox. Never put secrets or hashes in an event.
export abstract class DomainEvent {
  abstract readonly name: string;
  readonly id: string = newUuidV7();

  constructor(
    public readonly aggregateId: string,
    public readonly tenantId: Nullable<string>,
    public readonly occurredAt: string,
  ) {}
}
