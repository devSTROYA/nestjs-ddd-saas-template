import { Controller, Get } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { Throttle } from '@nestjs/throttler';
import { Pool } from 'pg';
import request from 'supertest';
import { inject } from 'vitest';

import { validateEnv } from '../config/index.js';
import { trustProxy } from '../http/index.js';
import { ERROR_STATUS_REGISTRY, ErrorFilter } from '../errors/index.js';
import { rateLimitErrorStatus } from './rate-limit.error.js';
import { RateLimitGuard } from './rate-limit.guard.js';
import { RateLimitModule } from './rate-limit.module.js';

const LIMIT = 2;

@Controller('limited')
class LimitedController {
  @Get()
  @Throttle({ default: { limit: LIMIT, ttl: 60_000 } })
  get(): { ok: true } {
    return { ok: true };
  }
}

const buildApp = async (proxyHops: number): Promise<NestFastifyApplication> => {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        validate: () =>
          validateEnv({
            DATABASE_URL: inject('databaseUrl'),
            OTP_SECRET: 'x'.repeat(32),
            JWT_SECRET: 'y'.repeat(32),
          }),
      }),
      RateLimitModule,
    ],
    controllers: [LimitedController],
    providers: [
      { provide: ERROR_STATUS_REGISTRY, useValue: rateLimitErrorStatus },
      { provide: APP_FILTER, useClass: ErrorFilter },
      { provide: APP_GUARD, useClass: RateLimitGuard },
    ],
  }).compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ trustProxy: trustProxy(proxyHops) }),
  );
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
};

describe('rate limiting over HTTP', () => {
  const pool = new Pool({ connectionString: inject('databaseUrl') });
  const apps: NestFastifyApplication[] = [];

  const open = async (proxyHops: number) => {
    const app = await buildApp(proxyHops);
    apps.push(app);
    return app;
  };

  const getAs = (app: NestFastifyApplication, forwardedFor: string) =>
    request(app.getHttpServer()).get('/limited').set('x-forwarded-for', forwardedFor);

  beforeEach(async () => {
    await pool.query('TRUNCATE TABLE rate_limits');
  });

  afterAll(async () => {
    await Promise.all(apps.map((app) => app.close()));
    await pool.end();
  });

  it('answers 429 with the error envelope and Retry-After once the limit is passed', async () => {
    const app = await open(0);
    const allowed = await getAs(app, '198.51.100.1').expect(200);
    await getAs(app, '198.51.100.1').expect(200);

    const blocked = await getAs(app, '198.51.100.1').expect(429);
    expect(allowed.headers['x-ratelimit-limit']).toBe(String(LIMIT));
    expect(allowed.headers['x-ratelimit-remaining']).toBe(String(LIMIT - 1));

    expect(blocked.body).toEqual({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfterSeconds: expect.any(Number),
      },
      requestId: expect.any(String),
    });
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('tells clients apart by X-Forwarded-For when the proxy is trusted', async () => {
    const app = await open(1);
    for (let i = 0; i < LIMIT; i++) {
      await getAs(app, '203.0.113.1').expect(200);
    }
    await getAs(app, '203.0.113.1').expect(429);

    await getAs(app, '203.0.113.2').expect(200);
  });

  it('ignores a spoofed X-Forwarded-For when no proxy is trusted', async () => {
    const app = await open(0);
    for (let i = 0; i < LIMIT; i++) {
      await getAs(app, `203.0.113.${i + 10}`).expect(200);
    }

    await getAs(app, '203.0.113.99').expect(429);
  });
});
