import type { DatabaseContext } from '@common/database';
import type { DomainEvent } from '@common/ddd';

import { outbox } from './outbox.schema.js';

// INFO: Queues events for the relay; call it inside the same transaction as the write that caused them.
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

// INFO: A clean aggregate has no change and no event, so it costs no transaction and no query.
export function saveAggregate(
  context: DatabaseContext,
  aggregate: { readonly isDirty: boolean; pullEvents(): DomainEvent[] },
  write: () => Promise<void>,
): Promise<void> {
  if (!aggregate.isDirty) {
    return Promise.resolve();
  }
  return context.run(async () => {
    await write();
    await appendEvents(context, aggregate.pullEvents());
  });
}
