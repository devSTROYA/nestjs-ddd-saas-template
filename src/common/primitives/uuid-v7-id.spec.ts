import { randomUUID } from 'node:crypto';

import { InvalidIdError } from './primitive.error.js';
import { parseUuidV7 } from './uuid-v7.js';
import { type UuidV7Id, uuidV7IdFactory } from './uuid-v7-id.js';

type FirstId = UuidV7Id<'FirstId'>;
const FirstId = uuidV7IdFactory<FirstId>();

type SecondId = UuidV7Id<'SecondId'>;
const SecondId = uuidV7IdFactory<SecondId>();

describe('uuidV7IdFactory', () => {
  it('generates a valid uuid v7', () => {
    const id = FirstId.generate();

    expect(parseUuidV7(id)).toBe(id);
    expect(FirstId.generate()).not.toBe(id);
  });

  it('is a plain string at runtime, so it compares and serialises as the uuid', () => {
    const id = FirstId.generate();

    expect(FirstId.parse(id)).toBe(id);
    expect(JSON.stringify({ id })).toBe(`{"id":"${id}"}`);
  });

  it('is not assignable to another id type', () => {
    const id = FirstId.generate();

    // @ts-expect-error a FirstId is not a SecondId
    const other: SecondId = id;

    expect(other).toBe(id);
  });

  it('parses a valid uuid v7 into the branded type', () => {
    const value = FirstId.generate();

    expect(SecondId.parse(value)).toBe(value);
  });

  it.each(['', 'abc', '00000000-0000-0000-0000-000000000000', randomUUID()])(
    'rejects %s on parse',
    (value) => {
      expect(() => FirstId.parse(value)).toThrow(InvalidIdError);
    },
  );

  it('rehydrates a persisted value without validating it', () => {
    expect(FirstId.rehydrate('not-validated')).toBe('not-validated');
  });
});
