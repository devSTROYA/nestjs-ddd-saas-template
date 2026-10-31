import type { Nullable } from '@common/types';

export type StoredEvent = {
  id: string;
  name: string;
  aggregateId: string;
  tenantId: Nullable<string>;
  occurredAt: Date;
  payload: unknown;
};

// Delivery is at-least-once: a consumer must tolerate the same event id arriving twice.
export interface OutboxConsumer {
  handle(event: StoredEvent): Promise<void>;
}
