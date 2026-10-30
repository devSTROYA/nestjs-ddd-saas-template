import { randomUUID } from 'node:crypto';

import { InvalidIdError } from './primitive.error.js';
import { newUuidV7, parseUuidV7 } from './uuid-v7.js';

describe('uuid v7', () => {
  it('generates ids that parse back unchanged', () => {
    const id = newUuidV7();
    expect(parseUuidV7(id)).toBe(id);
  });

  it('generates time-ordered ids', () => {
    const first = newUuidV7();
    const later = newUuidV7();
    expect([later, first].sort()[0]).toBe(first);
  });

  it.each(['', 'abc', '00000000-0000-0000-0000-000000000000', randomUUID()])(
    'rejects %s',
    (value) => {
      expect(() => parseUuidV7(value)).toThrow(InvalidIdError);
    },
  );
});
