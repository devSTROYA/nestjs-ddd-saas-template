export const OUTBOX_CONSUMERS = Symbol('OUTBOX_CONSUMERS');

export const OUTBOX_BATCH_SIZE = 50;
// A run delivers at most this many batches, so one HTTP-triggered run stays well under a request timeout.
export const MAX_OUTBOX_BATCHES_PER_RUN = 20;
export const MAX_OUTBOX_ATTEMPTS = 10;
export const MAX_OUTBOX_ERROR_LENGTH = 1000;
