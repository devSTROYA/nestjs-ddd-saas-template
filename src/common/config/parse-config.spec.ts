import { z } from 'zod';

import { ConfigValidationError, parseConfig } from './parse-config.js';

const schema = z.object({ MY_VARIABLE: z.string(), MY_PORT: z.coerce.number().int().min(1) });

const failure = (raw: Record<string, unknown>): ConfigValidationError => {
  try {
    parseConfig('sample', schema, raw);
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      return error;
    }
  }
  throw new Error('expected parseConfig to throw a ConfigValidationError');
};

describe('parseConfig', () => {
  it('returns the parsed values', () => {
    expect(parseConfig('sample', schema, { MY_VARIABLE: 'x', MY_PORT: '8080' })).toEqual({
      MY_VARIABLE: 'x',
      MY_PORT: 8080,
    });
  });

  it('names a missing variable as "<NAME> is required"', () => {
    const error = failure({ MY_PORT: '1' });

    expect(error.issues).toEqual([{ env: 'MY_VARIABLE', message: 'MY_VARIABLE is required' }]);
    expect(error.message).toContain('MY_VARIABLE is required');
    expect(error.message).not.toContain('received undefined');
  });

  it('keeps the validator message for a variable that is set but invalid', () => {
    const error = failure({ MY_VARIABLE: 'x', MY_PORT: '0' });

    expect(error.issues).toEqual([
      { env: 'MY_PORT', message: 'Too small: expected number to be >=1' },
    ]);
  });
});
