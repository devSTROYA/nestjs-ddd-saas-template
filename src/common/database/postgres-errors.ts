const UNIQUE_VIOLATION = '23505';

export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  while (typeof current === 'object' && current !== null) {
    if ('code' in current && current.code === UNIQUE_VIOLATION) {
      return true;
    }
    current = 'cause' in current ? current.cause : undefined;
  }
  return false;
}
