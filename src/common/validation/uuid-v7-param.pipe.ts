import type { PipeTransform } from '@nestjs/common';
import { z } from 'zod';

import { InputInvalidError } from './validation.error.js';

const uuidV7Schema = z.uuid({ version: 'v7' });

export class UuidV7ParamPipe implements PipeTransform<string, string> {
  constructor(private readonly name: string) {}

  transform(value: string): string {
    const result = uuidV7Schema.safeParse(value);
    if (!result.success) {
      throw new InputInvalidError(
        result.error.issues.map((issue) => ({ path: this.name, code: issue.code })),
      );
    }
    return result.data;
  }
}
