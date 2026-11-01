import { DomainEvent, type DomainEventProps } from '@common/ddd';

export const AdminEventNames = {
  CREATED: 'admin.created',
  EMAIL_CHANGED: 'admin.email_changed',
} as const;

export class AdminCreatedEvent extends DomainEvent {
  readonly name = AdminEventNames.CREATED;
  readonly email: string;

  constructor(props: DomainEventProps & { email: string }) {
    super(props);
    this.email = props.email;
  }
}

export class AdminEmailChangedEvent extends DomainEvent {
  readonly name = AdminEventNames.EMAIL_CHANGED;
  readonly email: string;

  constructor(props: DomainEventProps & { email: string }) {
    super(props);
    this.email = props.email;
  }
}
