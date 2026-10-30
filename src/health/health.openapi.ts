import { HttpStatus } from '@nestjs/common';
import { z } from 'zod';

import type { RouteDoc } from '@common/openapi';

import { HealthErrorCodes } from './health.error.js';

const TAG = 'Health';
const healthResponseSchema = z.object({ status: z.literal('ok') });

export const healthRouteDocs: readonly RouteDoc[] = [
  {
    method: 'get',
    path: '/health/live',
    tag: TAG,
    summary: 'Liveness: the process is up. Does not check dependencies',
    response: { status: HttpStatus.OK, description: 'Alive', schema: healthResponseSchema },
    errors: [],
  },
  {
    method: 'get',
    path: '/health/ready',
    tag: TAG,
    summary: 'Readiness: the service can reach its database',
    response: { status: HttpStatus.OK, description: 'Ready', schema: healthResponseSchema },
    errors: [HealthErrorCodes.NOT_READY],
  },
];
