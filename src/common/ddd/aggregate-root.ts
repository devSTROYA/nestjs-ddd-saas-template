import type { UuidV7Id } from '@common/primitives';

import type { DomainEvent } from './domain-event.js';
import { Entity } from './entity.js';

export abstract class AggregateRoot<Props extends object, Id extends UuidV7Id> extends Entity<
  Props,
  Id
> {
  private events: DomainEvent[] = [];

  protected addEvent(event: DomainEvent): void {
    this.events.push(event);
  }

  pullEvents(): DomainEvent[] {
    const pulled = this.events;
    this.events = [];
    return pulled;
  }
}
