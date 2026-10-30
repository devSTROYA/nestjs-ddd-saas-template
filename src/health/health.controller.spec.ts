import type { DatabaseContext } from '@common/database';

import { HealthController } from './health.controller.js';
import { NotReadyError } from './health.error.js';

const contextWhere = (execute: () => Promise<unknown>) =>
  ({ client: { execute } }) as unknown as DatabaseContext;

describe('HealthController', () => {
  it('is always alive', () => {
    const controller = new HealthController(contextWhere(() => Promise.reject(new Error('down'))));

    expect(controller.live()).toEqual({ status: 'ok' });
  });

  it('is ready when the database answers', async () => {
    const controller = new HealthController(contextWhere(() => Promise.resolve([])));

    await expect(controller.ready()).resolves.toEqual({ status: 'ok' });
  });

  it('is not ready when the database cannot be reached', async () => {
    const controller = new HealthController(contextWhere(() => Promise.reject(new Error('down'))));

    await expect(controller.ready()).rejects.toThrow(NotReadyError);
  });
});
