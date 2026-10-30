import type { z } from 'zod';

export type JsonObject = Record<string, unknown>;

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface PathParamDoc {
  description: string;
  schema: z.ZodType;
}

export interface RouteDoc {
  method: HttpMethod;
  path: string;
  tag: string;
  summary: string;
  auth?: 'bearer';
  pathParams?: Readonly<Record<string, PathParamDoc>>;
  body?: z.ZodType;
  response: { status: number; description: string; schema?: z.ZodType };
  errors: readonly string[];
}

export interface OpenApiInfo {
  title: string;
  version: string;
  serverUrl: string;
}
