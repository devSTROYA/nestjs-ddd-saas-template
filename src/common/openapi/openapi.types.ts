import type { z } from 'zod';

export type JsonObject = Record<string, unknown>;

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

type PathParamDoc = {
  description: string;
  schema: z.ZodType;
};

export type RouteDoc = {
  method: HttpMethod;
  path: string;
  tag: string;
  summary: string;
  auth?: 'bearer';
  pathParams?: Readonly<Record<string, PathParamDoc>>;
  body?: z.ZodType;
  response: { status: number; description: string; schema?: z.ZodType };
  errors: readonly string[];
};

export type OpenApiInfo = {
  title: string;
  version: string;
  serverUrl: string;
};
