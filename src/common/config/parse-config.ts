import { z } from 'zod';

export type ConfigIssue = { env: string; message: string };

export class ConfigValidationError extends Error {
  constructor(
    readonly namespace: string,
    readonly issues: readonly ConfigIssue[],
    prettified: string,
  ) {
    super(`Invalid ${namespace} config:\n${prettified}`);
    this.name = 'ConfigValidationError';
  }
}

export const emptyToUndefined = (value: unknown): unknown => (value === '' ? undefined : value);

type ZodIssue = z.ZodError['issues'][number];

// INFO: zod words a missing variable as "expected string, received undefined"; name the variable instead.
function messageOf(issue: ZodIssue, raw: Record<string, unknown>): string {
  const [env] = issue.path;
  const missing =
    issue.code === 'invalid_type' &&
    issue.path.length === 1 &&
    typeof env === 'string' &&
    raw[env] === undefined;
  return missing ? `${env} is required` : issue.message;
}

// INFO: Each namespace validates only the variables it owns, when its registerAs factory runs.
export function parseConfig<Schema extends z.ZodType>(
  name: string,
  schema: Schema,
  raw: Record<string, unknown> = process.env,
): z.output<Schema> {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const worded = result.error.issues.map((issue) => ({
      ...issue,
      message: messageOf(issue, raw),
    }));
    const issues = worded.map((issue) => ({
      env: String(issue.path[0] ?? name),
      message: issue.message,
    }));
    throw new ConfigValidationError(name, issues, z.prettifyError(new z.ZodError(worded)));
  }
  return result.data;
}
