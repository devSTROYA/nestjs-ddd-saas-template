import type { DatabaseContext } from '@common/database';
import type { DomainEvent } from '@common/ddd';

import { outbox } from './outbox.schema.js';

// Queues events for the relay. Call it inside the same transaction as the write that caused them.
export async function appendEvents(
  context: DatabaseContext,
  events: readonly DomainEvent[],
): Promise<void> {
  if (events.length === 0) {
    return;
  }
  await context.client.insert(outbox).values(
    events.map(({ id, name, aggregateId, tenantId, occurredAt, ...payload }) => ({
      id,
      name,
      aggregateId,
      tenantId,
      occurredAt: new Date(occurredAt),
      payload,
    })),
  );
}

// Writes the aggregate and its pending events in one transaction: it joins the use case's unit of
// work, or opens its own for a single-aggregate save. Events are published later by the relay.
export function saveAggregate(
  context: DatabaseContext,
  aggregate: { pullEvents(): DomainEvent[] },
  write: () => Promise<void>,
): Promise<void> {
  return context.run(async () => {
    await write();
    await appendEvents(context, aggregate.pullEvents());
  });
}
