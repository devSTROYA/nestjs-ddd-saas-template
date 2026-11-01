import pino, { type TransportSingleOptions } from 'pino';

import { accessLogLevel, isUnderPath, loggerParams, severityOf } from './logger.config.js';

function pinoHttpOptions(nodeEnv: string): Record<string, unknown> {
  const { pinoHttp } = loggerParams({ level: 'info', quietPath: '/h', nodeEnv });
  return pinoHttp as Record<string, unknown>;
}

describe('loggerParams', () => {
  it('uses the pretty transport without the severity formatter in development', () => {
    const options = pinoHttpOptions('development');
    expect(options['transport']).toMatchObject({ target: 'pino-pretty' });
    expect(options['formatters']).toBeUndefined();
    expect(options['redact']).toBeDefined();
  });

  it.each(['production', 'test'])('stays JSON with the severity formatter in %s', (env) => {
    const options = pinoHttpOptions(env);
    expect(options['transport']).toBeUndefined();
    expect(options['formatters']).toBeDefined();
    expect(options['redact']).toBeDefined();
  });

  it('keeps JSON in development when a stream is supplied', () => {
    const stream = { write: (): void => undefined };
    const { pinoHttp } = loggerParams({
      level: 'info',
      quietPath: '/h',
      nodeEnv: 'development',
      stream,
    });
    expect((pinoHttp as [Record<string, unknown>])[0]['transport']).toBeUndefined();
  });

  it('builds a logger with the pretty transport', () => {
    const options = pinoHttpOptions('development');
    const logger = pino({
      level: 'info',
      messageKey: 'message',
      transport: options['transport'] as TransportSingleOptions,
    });
    logger.info('hello');
    logger.flush();
    // INFO: worker thread is torn down with the test process
    expect(logger.level).toBe('info');
  });
});

describe('severityOf', () => {
  it('maps pino levels to Cloud Logging severities', () => {
    expect(severityOf('info')).toBe('INFO');
    expect(severityOf('error')).toBe('ERROR');
    expect(severityOf('warn')).toBe('WARNING');
    expect(severityOf('trace')).toBe('DEBUG');
    expect(severityOf('fatal')).toBe('CRITICAL');
  });
});

describe('accessLogLevel', () => {
  it('picks the level from the status code', () => {
    expect(accessLogLevel(200)).toBe('info');
    expect(accessLogLevel(302)).toBe('info');
    expect(accessLogLevel(404)).toBe('warn');
    expect(accessLogLevel(500)).toBe('error');
  });

  it('logs a request that failed with an error as error', () => {
    expect(accessLogLevel(200, new Error('boom'))).toBe('error');
  });
});

describe('isUnderPath', () => {
  it('matches the path and its children, ignoring the query string', () => {
    expect(isUnderPath('/v1/health/live', '/v1/health')).toBe(true);
    expect(isUnderPath('/v1/health?x=1', '/v1/health')).toBe(true);
    expect(isUnderPath('/v1/healthy', '/v1/health')).toBe(false);
    expect(isUnderPath(undefined, '/v1/health')).toBe(false);
  });
});
