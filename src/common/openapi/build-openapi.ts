import { z } from 'zod';

import type { JsonObject, OpenApiInfo, RouteDoc } from './openapi.types.js';

const JSON_CONTENT_TYPE = 'application/json';
const BEARER_SCHEME_NAME = 'bearerAuth';

type ErrorStatus = Readonly<Partial<Record<string, number>>>;

function toJsonSchema(schema: z.ZodType): JsonObject {
  const result: JsonObject = { ...z.toJSONSchema(schema) };
  delete result.$schema;
  return result;
}

// INFO: Error responses have no body schema; the description lists the error codes of that status.
function errorResponses(route: RouteDoc, errorStatus: ErrorStatus): JsonObject {
  const codesByStatus = new Map<number, string[]>();
  for (const code of route.errors) {
    const status = errorStatus[code];
    if (status === undefined) {
      throw new Error(
        `Route ${route.method.toUpperCase()} ${route.path} documents unmapped error code ${code}`,
      );
    }
    codesByStatus.set(status, [...(codesByStatus.get(status) ?? []), code]);
  }

  const responses: JsonObject = {};
  for (const [status, codes] of codesByStatus) {
    responses[String(status)] = { description: codes.join(', ') };
  }
  return responses;
}

function successResponse(route: RouteDoc): JsonObject {
  const { description, schema } = route.response;
  return schema
    ? { description, content: { [JSON_CONTENT_TYPE]: { schema: toJsonSchema(schema) } } }
    : { description };
}

function operation(route: RouteDoc, errorStatus: ErrorStatus): JsonObject {
  const parameters = Object.entries(route.pathParams ?? {}).map(([name, param]) => ({
    name,
    in: 'path',
    required: true,
    description: param.description,
    schema: toJsonSchema(param.schema),
  }));

  return {
    tags: [route.tag],
    summary: route.summary,
    ...(route.auth && { security: [{ [BEARER_SCHEME_NAME]: [] }] }),
    ...(parameters.length > 0 && { parameters }),
    ...(route.body && {
      requestBody: {
        required: true,
        content: { [JSON_CONTENT_TYPE]: { schema: toJsonSchema(route.body) } },
      },
    }),
    responses: {
      ...errorResponses(route, errorStatus),
      [String(route.response.status)]: successResponse(route),
    },
  };
}

export function buildOpenApiDocument(
  info: OpenApiInfo,
  routes: readonly RouteDoc[],
  errorStatus: ErrorStatus,
): JsonObject {
  const paths: Record<string, JsonObject> = {};
  for (const route of routes) {
    paths[route.path] = { ...paths[route.path], [route.method]: operation(route, errorStatus) };
  }

  return {
    openapi: '3.1.0',
    info: { title: info.title, version: info.version },
    servers: [{ url: info.serverUrl }],
    tags: [...new Set(routes.map((route) => route.tag))].map((name) => ({ name })),
    paths,
    ...(routes.some((route) => route.auth) && {
      components: {
        securitySchemes: {
          [BEARER_SCHEME_NAME]: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    }),
  };
}
