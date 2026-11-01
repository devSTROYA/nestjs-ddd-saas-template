import { randomUUID } from 'node:crypto';

import { InvalidIdError } from './primitive.error.js';
import { newUuidV7, parseUuidV7 } from './uuid-v7.js';
import { UuidV7Id } from './uuid-v7-id.js';

class FirstId extends UuidV7Id {
  declare private readonly firstIdBrand: true;

  static create(): FirstId {
    return new FirstId(newUuidV7());
  }

  static restore(value: string): FirstId {
    return new FirstId(parseUuidV7(value));
  }
}

class SecondId extends UuidV7Id {
  declare private readonly secondIdBrand: true;

  static restore(value: string): SecondId {
    return new SecondId(parseUuidV7(value));
  }
}

describe('UuidV7Id', () => {
  it('equals another id of the same class with the same value, even as a different instance', () => {
    const id = FirstId.create();

    expect(id.equals(FirstId.restore(id.value))).toBe(true);
    expect(id.equals(FirstId.create())).toBe(false);
  });

  it('never equals an id of another class with the same value', () => {
    const id = FirstId.create();

    expect(id.equals(SecondId.restore(id.value))).toBe(false);
  });

  it('is not assignable to another id class', () => {
    const id = FirstId.create();

    // @ts-expect-error a FirstId is not a SecondId
    const other: SecondId = id;

    expect(other.value).toBe(id.value);
  });

  it('serialises as the plain uuid', () => {
    const id = FirstId.create();

    expect(JSON.stringify({ id })).toBe(`{"id":"${id.value}"}`);
    expect(String(id)).toBe(id.value);
    expect(id.toString()).toBe(id.value);
    expect(id.toJSON()).toBe(id.value);
  });

  it('creates a valid uuid v7', () => {
    const id = FirstId.create();

    expect(parseUuidV7(id.value)).toBe(id.value);
  });

  it.each(['', 'abc', '00000000-0000-0000-0000-000000000000', randomUUID()])(
    'rejects %s on restore',
    (value) => {
      expect(() => FirstId.restore(value)).toThrow(InvalidIdError);
    },
  );
});
