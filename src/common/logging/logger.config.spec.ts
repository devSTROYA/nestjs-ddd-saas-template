import { accessLogLevel, isUnderPath, severityOf } from './logger.config.js';

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
