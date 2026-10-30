import { type ArgumentsHost, Logger } from '@nestjs/common';

import { DomainError } from './domain-error.js';
import { DomainErrorFilter } from './domain-error.filter.js';
import { INTERNAL_ERROR_CODE } from './error-status-registry.js';

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

const run = (error: DomainError) => {
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
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
  new DomainErrorFilter({ SAMPLE_MAPPED: 422 }).catch(error, host);
  return sent;
};

describe('DomainErrorFilter', () => {
  it('replies with the mapped status and the error code', () => {
    expect(run(new MappedError())).toEqual({
      status: 422,
      body: { error: { code: 'SAMPLE_MAPPED' } },
    });
  });

  it('adds the error details next to the code', () => {
    expect(run(new DetailedError())).toEqual({
      status: 422,
      body: { error: { code: 'SAMPLE_MAPPED', fields: [{ path: 'a' }] } },
    });
  });

  it('sets the Retry-After header when the error carries retryAfterSeconds', () => {
    expect(run(new ThrottledError())).toEqual({
      status: 422,
      headers: { 'retry-after': 30 },
      body: { error: { code: 'SAMPLE_MAPPED', retryAfterSeconds: 30 } },
    });
  });

  it('replies 500 with a generic code and logs when the code is unmapped', () => {
    const logged = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    expect(run(new UnmappedError())).toEqual({
      status: 500,
      body: { error: { code: INTERNAL_ERROR_CODE } },
    });
    expect(logged).toHaveBeenCalledWith('Unmapped error code SAMPLE_UNMAPPED', expect.any(String));
    logged.mockRestore();
  });
});
