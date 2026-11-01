import { newUuidV7 } from '@common/primitives';
import type { Nullable } from '@common/types';

// INFO: Events are serialised to the outbox, so add primitive fields only and never secrets or hashes.
export abstract class DomainEvent {
  abstract readonly name: string;
  readonly id: string = newUuidV7();

  constructor(
    public readonly aggregateId: string,
    public readonly tenantId: Nullable<string>,
    public readonly occurredAt: string,
  ) {}
}
