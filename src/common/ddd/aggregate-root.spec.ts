import { type UuidV7Id, uuidV7IdFactory } from '@common/primitives';

import { AggregateRoot } from './aggregate-root.js';
import { DomainEvent } from './domain-event.js';

type SampleId = UuidV7Id<'SampleId'>;
const SampleId = uuidV7IdFactory<SampleId>();

class SampleEvent extends DomainEvent {
  readonly name = 'sample.changed';
}

class Sample extends AggregateRoot<{ value: number }, SampleId> {
  static rehydrate(): Sample {
    return new Sample({ value: 0 }, SampleId.generate());
  }

  change(): void {
    this.props.value += 1;
    this.addEvent(
      new SampleEvent({
        aggregateId: this.id,
        tenantId: null,
        occurredAt: new Date().toISOString(),
      }),
    );
  }
}

describe('AggregateRoot', () => {
  it('is clean until it changes', () => {
    expect(Sample.rehydrate().isDirty).toBe(false);
  });

  it('is dirty once it raises an event', () => {
    const sample = Sample.rehydrate();

    sample.change();

    expect(sample.isDirty).toBe(true);
  });

  it('stays dirty after its events are pulled, so a retried save still writes', () => {
    const sample = Sample.rehydrate();
    sample.change();

    expect(sample.pullEvents()).toHaveLength(1);

    expect(sample.isDirty).toBe(true);
  });
});
