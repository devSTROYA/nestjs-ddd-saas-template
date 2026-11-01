import { newUuidV7 } from '@common/primitives';
import type { Nullable } from '@common/types';

export type DomainEventProps = {
  aggregateId: string;
  tenantId: Nullable<string>;
  occurredAt: string;
};

// INFO: Events are serialised to the outbox, so add primitive fields only and never secrets or hashes.
export abstract class DomainEvent {
  abstract readonly name: string;
  readonly id: string = newUuidV7();
  readonly aggregateId: string;
  readonly tenantId: Nullable<string>;
  readonly occurredAt: string;

  constructor(props: DomainEventProps) {
    this.aggregateId = props.aggregateId;
    this.tenantId = props.tenantId;
    this.occurredAt = props.occurredAt;
  }
}
