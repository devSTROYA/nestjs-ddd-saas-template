import type { IncomingMessage, ServerResponse } from 'node:http';

import type { Params } from 'nestjs-pino';
import type { DestinationStream, LevelWithSilent } from 'pino';

const SERVER_ERROR_MIN = 500;
const CLIENT_ERROR_MIN = 400;
const MESSAGE_KEY = 'message';

const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["set-cookie"]',
  'res.headers["set-cookie"]',
];

// INFO: Cloud Logging severity names for the pino levels that differ from their uppercase label
const SEVERITY_BY_LEVEL: Readonly<Record<string, string>> = {
  trace: 'DEBUG',
  warn: 'WARNING',
  fatal: 'CRITICAL',
};

export function severityOf(level: string): string {
  return SEVERITY_BY_LEVEL[level] ?? level.toUpperCase();
}

export function accessLogLevel(statusCode: number, error?: Error): LevelWithSilent {
  if (error !== undefined || statusCode >= SERVER_ERROR_MIN) {
    return 'error';
  }
  return statusCode >= CLIENT_ERROR_MIN ? 'warn' : 'info';
}

export function isUnderPath(url: string | undefined, path: string): boolean {
  if (url === undefined) {
    return false;
  }
  const pathname = url.split('?')[0] ?? '';
  return pathname === path || pathname.startsWith(`${path}/`);
}

type LoggerOptions = {
  level: LevelWithSilent;
  // INFO: requests under this path are not access-logged (health probes)
  quietPath: string;
  stream?: DestinationStream;
};

export function loggerParams({ level, quietPath, stream }: LoggerOptions): Params {
  const options = {
    level,
    messageKey: MESSAGE_KEY,
    formatters: { level: (label: string) => ({ severity: severityOf(label) }) },
    redact: REDACTED_PATHS,
    // INFO: puts `reqId` (not the whole req object) on every line logged during the request
    quietReqLogger: true,
    customLogLevel: (_req: IncomingMessage, res: ServerResponse, error?: Error) =>
      accessLogLevel(res.statusCode, error),
    autoLogging: { ignore: (req: IncomingMessage) => isUnderPath(req.url, quietPath) },
  };
  return { pinoHttp: stream === undefined ? options : [options, stream] };
}
