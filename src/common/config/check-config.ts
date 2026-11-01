import { Logger } from '@nestjs/common';

import { type ConfigIssue, ConfigValidationError } from './parse-config.js';

type ConfigFactory = () => unknown;

const EXIT_CODE = 1;

export function collectConfigErrors(configs: readonly ConfigFactory[]): ConfigValidationError[] {
  const errors: ConfigValidationError[] = [];
  for (const config of configs) {
    try {
      config();
    } catch (error) {
      if (!(error instanceof ConfigValidationError)) {
        throw error;
      }
      errors.push(error);
    }
  }
  return errors;
}

// INFO: "X is required" already names the variable; any other validator message gets the name in front.
function describe({ env, message }: ConfigIssue): string {
  return message.startsWith(env) ? message : `${env}: ${message}`;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export function formatConfigErrors(errors: readonly ConfigValidationError[]): string[] {
  const total = errors.reduce((sum, error) => sum + error.issues.length, 0);
  const variables = new Set(errors.flatMap((error) => error.issues.map((issue) => issue.env)));
  const lines = [
    `Invalid configuration: ${plural(total, 'error')} in ${plural(variables.size, 'variable')}`,
  ];
  for (const error of errors) {
    lines.push(`[${error.namespace}]`);
    lines.push(...error.issues.map((issue) => `  ${describe(issue)}`));
  }
  lines.push('See .env.example for the expected variables.');
  return lines;
}

export function checkConfigOrExit(
  configs: readonly ConfigFactory[],
  logger: Pick<Logger, 'error'> = new Logger('Config'),
): void {
  const errors = collectConfigErrors(configs);
  if (errors.length === 0) {
    return;
  }
  for (const line of formatConfigErrors(errors)) {
    logger.error(line);
  }
  process.exit(EXIT_CODE);
}
