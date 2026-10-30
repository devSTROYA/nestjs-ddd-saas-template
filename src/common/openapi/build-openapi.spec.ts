import { z } from 'zod';

import { buildOpenApiDocument } from './build-openapi.js';
import type { RouteDoc } from './openapi.types.js';

const INFO = { title: 'Test API', version: '1.2.3', serverUrl: '/v1' };
const STATUS = { INPUT_INVALID: 422, ITEM_MISSING: 404, ITEM_LOCKED: 404 };
const PATH = '/items/{id}/open';
const JSON_TYPE = 'application/json';

const route: RouteDoc = {
  method: 'post',
  path: PATH,
  tag: 'Items',
  summary: 'Open an item',
  pathParams: { id: { description: 'Item id', schema: z.uuid() } },
  body: z.object({ code: z.string().regex(/^\d{6}$/) }),
  response: { status: 201, description: 'Opened', schema: z.object({ itemId: z.uuid() }) },
  errors: ['INPUT_INVALID', 'ITEM_MISSING', 'ITEM_LOCKED'],
};

const build = (routes: readonly RouteDoc[] = [route]) => buildOpenApiDocument(INFO, routes, STATUS);

const at = (value: unknown, ...path: string[]): unknown =>
  path.reduce<unknown>(
    (current, key) =>
      typeof current === 'object' && current !== null
        ? (current as Record<string, unknown>)[key]
        : undefined,
    value,
  );

const responseSchema = (document: unknown, status: string): unknown =>
  at(document, 'paths', PATH, 'post', 'responses', status, 'content', JSON_TYPE, 'schema');

describe('buildOpenApiDocument', () => {
  it('describes the document, server and tags', () => {
    const document = build();

    expect(document.openapi).toBe('3.1.0');
    expect(document.info).toEqual({ title: 'Test API', version: '1.2.3' });
    expect(document.servers).toEqual([{ url: '/v1' }]);
    expect(document.tags).toEqual([{ name: 'Items' }]);
  });

  it('builds path parameters from the zod schemas', () => {
    expect(at(build(), 'paths', PATH, 'post', 'parameters')).toMatchObject([
      { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
    ]);
  });

  it('builds the request body and the success response from the zod schemas', () => {
    const document = build();

    expect(
      at(document, 'paths', PATH, 'post', 'requestBody', 'content', JSON_TYPE, 'schema'),
    ).toMatchObject({
      type: 'object',
      properties: { code: { type: 'string', pattern: '^\\d{6}$' } },
      required: ['code'],
    });
    expect(responseSchema(document, '201')).toMatchObject({
      properties: { itemId: { type: 'string', format: 'uuid' } },
    });
  });

  it('does not leak the $schema keyword into the document', () => {
    expect(JSON.stringify(build())).not.toContain('$schema');
  });

  it('lists each error status once, describing it with its error codes and no body', () => {
    const responses = at(build(), 'paths', PATH, 'post', 'responses') as Record<string, unknown>;

    expect(Object.keys(responses).sort()).toEqual(['201', '404', '422']);
    expect(responses['404']).toEqual({ description: 'ITEM_MISSING, ITEM_LOCKED' });
    expect(responses['422']).toEqual({ description: 'INPUT_INVALID' });
  });

  it('merges several methods under one path', () => {
    const document = build([route, { ...route, method: 'get', summary: 'Read' }]);

    expect(Object.keys(at(document, 'paths', PATH) as object)).toEqual(['post', 'get']);
  });

  it('fails when a route documents an error code that has no status', () => {
    expect(() => build([{ ...route, errors: ['NOT_MAPPED'] }])).toThrow(/NOT_MAPPED/);
  });

  it('marks protected routes with the bearer scheme and declares it once', () => {
    const document = build([route, { ...route, method: 'get', auth: 'bearer' }]);

    expect(at(document, 'paths', PATH, 'post', 'security')).toBeUndefined();
    expect(at(document, 'paths', PATH, 'get', 'security')).toEqual([{ bearerAuth: [] }]);
    expect(at(document, 'components', 'securitySchemes', 'bearerAuth')).toEqual({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    });
    expect(at(build(), 'components')).toBeUndefined();
  });

  it('describes a response without a body when no schema is given', () => {
    const document = build([{ ...route, response: { status: 204, description: 'No content' } }]);

    expect(at(document, 'paths', PATH, 'post', 'responses', '204')).toEqual({
      description: 'No content',
    });
  });
});
