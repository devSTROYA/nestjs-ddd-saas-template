import { Writable } from 'node:stream';
import { generateRequestId } from '@common/http';
import { loggerParams } from '@common/logging';
import { Logger, PARAMS_PROVIDER_TOKEN } from 'nestjs-pino';
import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';

describe('AppController (e2e)', () => {
  let app: NestFastifyApplication;
  let logLines: Record<string, unknown>[];

  beforeEach(async () => {
    logLines = [];
    const logStream = new Writable({
      write(chunk: Buffer, _encoding, done) {
        logLines.push(JSON.parse(chunk.toString()) as Record<string, unknown>);
        done();
      },
    });
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ThrottlerStorage)
      .useValue(new ThrottlerStorageService())
      .overrideProvider(PARAMS_PROVIDER_TOKEN)
      .useValue(loggerParams({ level: 'info', quietPath: '/v1/health', stream: logStream }))
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter({ genReqId: generateRequestId }),
      { bufferLogs: true },
    );
    app.useLogger(app.get(Logger));
    await configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer()).get('/v1').expect(200).expect('Hello World!');
  });

  it('sets x-request-id on every response', async () => {
    const response = await request(app.getHttpServer()).get('/v1').expect(200);
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
  });

  it('answers an unknown route with the NOT_FOUND envelope and a request id', async () => {
    const response = await request(app.getHttpServer()).get('/v1/nope').expect(404);
    expect(response.body).toEqual({
      error: { code: 'NOT_FOUND' },
      requestId: expect.any(String),
    });
    expect(response.headers['x-request-id']).toBe(response.body.requestId);
  });

  it('uses one request id in the header, the error body and the access log', async () => {
    const response = await request(app.getHttpServer()).get('/v1/nope').expect(404);

    const [line] = logLines.filter((entry) => entry.res !== undefined);
    expect(line).toMatchObject({ severity: 'WARNING', reqId: response.body.requestId });
    expect(response.headers['x-request-id']).toBe(response.body.requestId);
  });

  afterEach(async () => {
    await app.close();
  });
});
