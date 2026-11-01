import { DomainEvent, type DomainEventProps } from '@common/ddd';

export const UserEventNames = {
  CREATED: 'user.created',
  RENAMED: 'user.renamed',
} as const;

export class UserCreatedEvent extends DomainEvent {
  readonly name = UserEventNames.CREATED;
  readonly email: string;
  readonly userName: string;

  constructor(props: DomainEventProps & { email: string; userName: string }) {
    super(props);
    this.email = props.email;
    this.userName = props.userName;
  }
}

export class UserRenamedEvent extends DomainEvent {
  readonly name = UserEventNames.RENAMED;
  readonly userName: string;

  constructor(props: DomainEventProps & { userName: string }) {
    super(props);
    this.userName = props.userName;
  }
}
