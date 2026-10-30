import type { PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

import { InputInvalidError } from './validation.error.js';

export class ZodValidationPipe<TSchema extends z.ZodType> implements PipeTransform<
  unknown,
  z.output<TSchema>
> {
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown): z.output<TSchema> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new InputInvalidError(
        result.error.issues.map((issue) => ({
          path: issue.path.map(String).join('.'),
          code: issue.code,
        })),
      );
    }
    return result.data;
  }
}
