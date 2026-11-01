import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { DiscoveryModule, DiscoveryService } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';
import { LatteColor, MochaColor } from './../src/common/docs-theme/index.js';
import { apiRouteDocs } from './../src/openapi.js';

const UNDOCUMENTED_ROUTES = new Set(['GET /']);

const normalizePath = (path: string): string =>
  `/${path}`
    .replace(/\/+/g, '/')
    .replace(/(.)\/$/, '$1')
    .replace(/:([A-Za-z0-9_]+)/g, '{$1}');

const createApp = async (docs: boolean): Promise<NestFastifyApplication> => {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule, DiscoveryModule],
  })
    .overrideProvider(ThrottlerStorage)
    .useValue(new ThrottlerStorageService())
    .compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  await configureApp(app, { docs });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
};

const discoverRoutes = (app: NestFastifyApplication): string[] => {
  const routes: string[] = [];
  for (const wrapper of app.get(DiscoveryService, { strict: false }).getControllers()) {
    const controller = wrapper.metatype;
    if (!controller) {
      continue;
    }
    const basePath = Reflect.getMetadata(PATH_METADATA, controller) as string;
    const prototype = controller.prototype as Record<string, unknown>;
    for (const name of Object.getOwnPropertyNames(prototype)) {
      const handler = prototype[name];
      if (typeof handler !== 'function') {
        continue;
      }
      const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
      if (method === undefined) {
        continue;
      }
      const path = Reflect.getMetadata(PATH_METADATA, handler) as string;
      routes.push(`${RequestMethod[method]} ${normalizePath(`${basePath}/${path}`)}`);
    }
  }
  return routes;
};

describe('API documentation', () => {
  describe('when enabled', () => {
    let app: NestFastifyApplication;

    beforeAll(async () => {
      app = await createApp(true);
    });

    afterAll(async () => {
      await app.close();
    });

    it('serves the OpenAPI document as JSON', async () => {
      const response = await request(app.getHttpServer()).get('/docs/openapi.json').expect(200);

      expect(response.headers['content-type']).toContain('application/json');
      expect(response.headers['content-disposition']).toBe('attachment; filename="openapi.json"');
      expect(response.body).toMatchObject({
        openapi: '3.1.0',
        servers: [{ url: '/v1' }],
        paths: { '/invitations/{id}/accept': { post: { tags: ['Invitations'] } } },
      });
    });

    it('serves the Scalar reference page', async () => {
      const response = await request(app.getHttpServer()).get('/docs').expect(200);

      expect(response.headers['content-type']).toContain('text/html');
      expect(response.text).toContain('Scalar');
      expect(response.text).toContain('kepler');
      expect(response.text).toMatch(/showDeveloperTools["']?\s*:\s*["']never["']/);
      expect(response.text).toMatch(/agent["']?\s*:\s*\{\s*["']?disabled["']?\s*:\s*true/);
      expect(response.text).toMatch(/hideTestRequestButton["']?\s*:\s*true/);
      expect(response.text).toMatch(/hideClientButton["']?\s*:\s*true/);
      expect(response.text).toContain('.response-card .scalar-card-checkbox { display: none; }');
      expect(response.text).toContain(`--ctp-lavender: ${LatteColor.lavender};`);
      expect(response.text).toContain(`--ctp-lavender: ${MochaColor.lavender};`);
    });

    it('uses the lavender accent by default and lets ?accent= pick another one', async () => {
      const fetchPage = async (path: string): Promise<string> =>
        (await request(app.getHttpServer()).get(path).expect(200)).text;

      expect(await fetchPage('/docs')).toContain('--ctp-accent: var(--ctp-lavender);');
      expect(await fetchPage('/docs?accent=mauve')).toContain('--ctp-accent: var(--ctp-mauve);');
      expect(await fetchPage('/docs?accent=peach')).toContain('--ctp-accent: var(--ctp-peach);');
    });

    it('ignores an accent that is not one of the Catppuccin accents', async () => {
      for (const accent of ['banana', 'surface0', 'red;}</style><script>x</script>']) {
        const page = (await request(app.getHttpServer()).get('/docs').query({ accent }).expect(200))
          .text;

        expect(page).toContain('--ctp-accent: var(--ctp-lavender);');
        expect(page).not.toContain('<script>x</script>');
      }
    });

    describe('color mode', () => {
      const CLEAR_SCRIPT = "localStorage.removeItem('colorMode')";
      const HIDDEN_TOGGLE = /hideDarkModeToggle["']?\s*:\s*true/;
      const fetchPage = async (query: Record<string, string>): Promise<string> =>
        (await request(app.getHttpServer()).get('/docs').query(query).expect(200)).text;

      it('keeps the Scalar toggle by default and injects nothing', async () => {
        const page = await fetchPage({});

        expect(page).not.toMatch(HIDDEN_TOGGLE);
        expect(page).not.toContain(CLEAR_SCRIPT);
        expect(page).not.toContain('forceDarkModeState');
      });

      it('hides the toggle and drops a stored choice with ?mode=system', async () => {
        const page = await fetchPage({ mode: 'system' });

        expect(page).toMatch(HIDDEN_TOGGLE);
        expect(page).toContain(CLEAR_SCRIPT);
        expect(page).not.toContain('location.reload');
        expect(page).not.toContain('forceDarkModeState');
      });

      it('falls back to toggle for an unknown mode', async () => {
        for (const mode of ['banana', 'dark', 'system"}</script><script>x</script>']) {
          const page = await fetchPage({ mode });

          expect(page).not.toMatch(HIDDEN_TOGGLE);
          expect(page).not.toContain(CLEAR_SCRIPT);
          expect(page).not.toContain('<script>x</script>');
        }
      });
    });

    it('documents every route of the application and nothing that does not exist', () => {
      const documented = apiRouteDocs.map(
        (route) => `${route.method.toUpperCase()} ${normalizePath(route.path)}`,
      );
      const discovered = discoverRoutes(app).filter((route) => !UNDOCUMENTED_ROUTES.has(route));

      expect([...documented].sort()).toEqual([...discovered].sort());
    });
  });

  it('is not served when disabled', async () => {
    const app = await createApp(false);

    await request(app.getHttpServer()).get('/docs').expect(404);
    await request(app.getHttpServer()).get('/docs/openapi.json').expect(404);
    await app.close();
  });
});
