const MINUTE_MS = 60 * 1000;
const QUARTER_HOUR_MS = 15 * MINUTE_MS;

export const LOGIN_CODE_PER_IP = { default: { limit: 10, ttl: QUARTER_HOUR_MS } };
export const LOGIN_VERIFY_PER_IP = { default: { limit: 10, ttl: QUARTER_HOUR_MS } };
export const REFRESH_PER_IP = { default: { limit: 30, ttl: MINUTE_MS } };
