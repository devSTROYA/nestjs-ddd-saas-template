import { HttpStatus } from '@nestjs/common';

import { PrimitiveErrorCodes, type PrimitiveErrorCode } from './primitive.error.js';

export const primitiveErrorStatus = {
  [PrimitiveErrorCodes.EMAIL_INVALID]: HttpStatus.UNPROCESSABLE_ENTITY,
  [PrimitiveErrorCodes.ID_INVALID]: HttpStatus.UNPROCESSABLE_ENTITY,
} as const satisfies Record<PrimitiveErrorCode, number>;
