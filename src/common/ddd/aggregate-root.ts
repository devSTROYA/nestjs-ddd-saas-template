import type { UuidV7Id } from '@common/primitives';

import type { DomainEvent } from './domain-event.js';
import { Entity } from './entity.js';

export abstract class AggregateRoot<
  Props extends object,
  Id extends UuidV7Id<string>,
> extends Entity<Props, Id> {
  private events: DomainEvent[] = [];
  private dirty = false;

  // INFO: True once the aggregate changed since it was created or rehydrated, so a clean one needs no
  // write. Every change raises an event, which is what sets it. It is never cleared, because a retried
  // unit of work may save the same instance again.
  get isDirty(): boolean {
    return this.dirty;
  }

  protected addEvent(event: DomainEvent): void {
    this.events.push(event);
    this.dirty = true;
  }

  pullEvents(): DomainEvent[] {
    const pulled = this.events;
    this.events = [];
    return pulled;
  }
}
