import { type ArgumentsHost, BadRequestException, Logger } from '@nestjs/common';

import { DomainError } from './domain-error.js';
import { ErrorFilter } from './error.filter.js';
import { INTERNAL_ERROR_CODE } from './error-status-registry.js';

const REQUEST_ID = 'req-1';

class MappedError extends DomainError {
  constructor() {
    super('SAMPLE_MAPPED', 'Mapped');
  }
}

class DetailedError extends DomainError {
  constructor() {
    super('SAMPLE_MAPPED', 'Detailed', { fields: [{ path: 'a' }] });
  }
}

class UnmappedError extends DomainError {
  constructor() {
    super('SAMPLE_UNMAPPED', 'Unmapped');
  }
}

class ThrottledError extends DomainError {
  constructor() {
    super('SAMPLE_MAPPED', 'Throttled', { retryAfterSeconds: 30 });
  }
}

const run = (error: unknown) => {
  const sent: { status?: number; body?: unknown; headers?: Record<string, unknown> } = {};
  const response = {
    header: (name: string, value: unknown) => {
      sent.headers = { ...sent.headers, [name]: value };
      return response;
    },
    status: (code: number) => {
      sent.status = code;
      return response;
    },
    send: (body: unknown) => {
      sent.body = body;
      return response;
    },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ id: REQUEST_ID }),
    }),
  } as unknown as ArgumentsHost;
  new ErrorFilter({ SAMPLE_MAPPED: 422 }).catch(error, host);
  return sent;
};

describe('ErrorFilter', () => {
  it('replies with the mapped status, the error code and the request id', () => {
    expect(run(new MappedError())).toEqual({
      status: 422,
      body: { error: { code: 'SAMPLE_MAPPED' }, requestId: REQUEST_ID },
    });
  });

  it('adds the error details next to the code', () => {
    expect(run(new DetailedError())).toEqual({
      status: 422,
      body: {
        error: { code: 'SAMPLE_MAPPED', fields: [{ path: 'a' }] },
        requestId: REQUEST_ID,
      },
    });
  });

  it('sets the Retry-After header when the error carries retryAfterSeconds', () => {
    expect(run(new ThrottledError())).toEqual({
      status: 422,
      headers: { 'retry-after': 30 },
      body: { error: { code: 'SAMPLE_MAPPED', retryAfterSeconds: 30 }, requestId: REQUEST_ID },
    });
  });

  it('replies 500 with a generic code and logs it when the code is unmapped', () => {
    const logged = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    expect(run(new UnmappedError())).toEqual({
      status: 500,
      body: { error: { code: INTERNAL_ERROR_CODE }, requestId: REQUEST_ID },
    });
    expect(logged).toHaveBeenCalledWith('Unmapped error code SAMPLE_UNMAPPED', expect.any(String));
    logged.mockRestore();
  });

  it('keeps the status of an HttpException and never echoes its message', () => {
    expect(run(new BadRequestException('secret detail'))).toEqual({
      status: 400,
      body: { error: { code: 'BAD_REQUEST' }, requestId: REQUEST_ID },
    });
  });

  it('keeps the status of a Fastify error and falls back to REQUEST_INVALID for unlisted 4xx', () => {
    expect(run(Object.assign(new Error('boom'), { statusCode: 415 })).body).toEqual({
      error: { code: 'UNSUPPORTED_MEDIA_TYPE' },
      requestId: REQUEST_ID,
    });
    expect(run(Object.assign(new Error('boom'), { statusCode: 418 }))).toEqual({
      status: 418,
      body: { error: { code: 'REQUEST_INVALID' }, requestId: REQUEST_ID },
    });
  });

  it('replies 500 without leaking the message of an unexpected error, and logs it', () => {
    const logged = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    const sent = run(new Error('db password is hunter2'));

    expect(sent).toEqual({
      status: 500,
      body: { error: { code: INTERNAL_ERROR_CODE }, requestId: REQUEST_ID },
    });
    expect(logged).toHaveBeenCalledWith('Unhandled error', expect.any(String));
    logged.mockRestore();
  });

  it('treats a 5xx statusCode as an internal error', () => {
    const logged = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    expect(run(Object.assign(new Error('x'), { statusCode: 503 })).status).toBe(500);
    logged.mockRestore();
  });
});
