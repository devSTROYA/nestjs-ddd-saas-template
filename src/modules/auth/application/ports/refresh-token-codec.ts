export interface RefreshTokenCodec {
  generate(): string;
  hash(token: string): string;
}

export const REFRESH_TOKEN_CODEC = Symbol('REFRESH_TOKEN_CODEC');
