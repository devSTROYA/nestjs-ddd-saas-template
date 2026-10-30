export type ErrorStatusRegistry = Readonly<Partial<Record<string, number>>>;

export const ERROR_STATUS_REGISTRY = Symbol('ERROR_STATUS_REGISTRY');

export const INTERNAL_ERROR_CODE = 'INTERNAL_ERROR';

export const RETRY_AFTER_DETAIL = 'retryAfterSeconds';
