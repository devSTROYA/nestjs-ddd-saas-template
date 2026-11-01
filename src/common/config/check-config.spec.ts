import { z } from 'zod';

import { checkConfigOrExit, collectConfigErrors, formatConfigErrors } from './check-config.js';
import { parseConfig } from './parse-config.js';

const database = (): unknown =>
  parseConfig(
    'database',
    z.object({ DATABASE_URL: z.url(), DATABASE_POOL_MAX: z.coerce.number().int().min(1) }),
    { DATABASE_POOL_MAX: '0' },
  );
const otp = (): unknown => parseConfig('otp', z.object({ OTP_SECRET: z.string().min(32) }), {});
const valid = (): unknown => parseConfig('ok', z.object({ A: z.string().default('a') }), {});
const unknown = (): unknown => {
  throw new TypeError('boom');
};

describe('collectConfigErrors', () => {
  it('aggregates errors across namespaces and skips valid ones', () => {
    const errors = collectConfigErrors([database, valid, otp]);

    expect(errors.map((error) => error.namespace)).toEqual(['database', 'otp']);
    expect(errors[0]?.issues.map((issue) => issue.env)).toEqual([
      'DATABASE_URL',
      'DATABASE_POOL_MAX',
    ]);
  });

  it('rethrows anything that is not a config validation error', () => {
    expect(() => collectConfigErrors([unknown])).toThrow('boom');
  });
});

describe('formatConfigErrors', () => {
  it('prints one line per error, naming the variable, and counts them in the summary', () => {
    const errors = collectConfigErrors([database, otp]);
    const lines = formatConfigErrors(errors);

    expect(lines).toEqual([
      'Invalid configuration: 3 errors in 3 variables',
      '[database]',
      '  DATABASE_URL is required',
      '  DATABASE_POOL_MAX: Too small: expected number to be >=1',
      '[otp]',
      '  OTP_SECRET is required',
      'See .env.example for the expected variables.',
    ]);
  });

  it('prints every error of a variable with several issues on its own line', () => {
    const twice = (): unknown =>
      parseConfig('otp', z.object({ OTP_SECRET: z.string().min(32).regex(/^z+$/) }), {
        OTP_SECRET: 'x',
      });

    expect(formatConfigErrors(collectConfigErrors([twice]))).toEqual([
      'Invalid configuration: 2 errors in 1 variable',
      '[otp]',
      '  OTP_SECRET: Too small: expected string to have >=32 characters',
      '  OTP_SECRET: Invalid string: must match pattern /^z+$/',
      'See .env.example for the expected variables.',
    ]);
  });
});

describe('checkConfigOrExit', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs every line and exits with 1 when a config is invalid', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit');
    });
    const logger = { error: vi.fn() };

    expect(() => checkConfigOrExit([database, otp], logger)).toThrow('exit');

    expect(exit).toHaveBeenCalledWith(1);
    expect(logger.error.mock.calls.map(([line]) => line)).toEqual(
      formatConfigErrors(collectConfigErrors([database, otp])),
    );
  });

  it('does not exit when every config is valid', () => {
    const exit = vi.spyOn(process, 'exit');
    const logger = { error: vi.fn() };

    checkConfigOrExit([valid], logger);

    expect(exit).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });
});
