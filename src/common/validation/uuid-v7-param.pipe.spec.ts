import { newUuidV7 } from '@common/primitives';

import { UuidV7ParamPipe } from './uuid-v7-param.pipe.js';
import { InputInvalidError, ValidationErrorCodes } from './validation.error.js';

describe('UuidV7ParamPipe', () => {
  const pipe = new UuidV7ParamPipe('workspaceId');

  it('returns a valid UUID v7 untouched', () => {
    const id = newUuidV7();

    expect(pipe.transform(id)).toBe(id);
  });

  it.each(['nope', '', '123e4567-e89b-42d3-a456-426614174000'])(
    'rejects %j and names the parameter',
    (value) => {
      expect(() => pipe.transform(value)).toThrow(InputInvalidError);
      try {
        pipe.transform(value);
      } catch (error) {
        expect(error).toMatchObject({
          code: ValidationErrorCodes.INPUT_INVALID,
          details: { fields: [{ path: 'workspaceId', code: 'invalid_format' }] },
        });
      }
    },
  );
});
