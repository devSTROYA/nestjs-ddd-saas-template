import { z } from 'zod';

import { InputInvalidError } from './validation.error.js';
import { ZodValidationPipe } from './zod-validation.pipe.js';

const schema = z.object({
  otp: z.string().regex(/^\d{6}$/),
  profile: z.object({ name: z.string() }),
});

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(schema);

  it('returns the parsed value', () => {
    const value = { otp: '123456', profile: { name: 'Uz' } };
    expect(pipe.transform(value)).toEqual(value);
  });

  it('drops unknown keys', () => {
    expect(pipe.transform({ otp: '123456', profile: { name: 'Uz' }, extra: 1 })).toEqual({
      otp: '123456',
      profile: { name: 'Uz' },
    });
  });

  it('reports every invalid field with a nested path and a zod issue code', () => {
    let thrown: unknown;
    try {
      pipe.transform({ otp: '12', profile: {} });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(InputInvalidError);
    expect((thrown as InputInvalidError).details).toEqual({
      fields: [
        { path: 'otp', code: 'invalid_format' },
        { path: 'profile.name', code: 'invalid_type' },
      ],
    });
  });

  it('rejects a non-object body', () => {
    expect(() => pipe.transform(undefined)).toThrow(InputInvalidError);
  });
});
