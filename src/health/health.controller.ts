import { Controller, Get, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import { DATABASE_CONTEXT, type DatabaseContext } from '@common/database';
import { SkipThrottle } from '@common/rate-limit';
import { Public } from '@modules/auth';

import { NotReadyError } from './health.error.js';

export type HealthResponse = {
  status: 'ok';
};

@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(@Inject(DATABASE_CONTEXT) private readonly context: DatabaseContext) {}

  @Get('live')
  live(): HealthResponse {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready(): Promise<HealthResponse> {
    try {
      await this.context.client.execute(sql`select 1`);
    } catch {
      throw new NotReadyError();
    }
    return { status: 'ok' };
  }
}
