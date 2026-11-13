import type { DatabaseContext } from '@common/database';

import { saveAggregate } from './save-aggregate.js';

const context = () => {
  const run = vi.fn(async (work: () => Promise<void>) => work());
  return { run, asContext: { run } as unknown as DatabaseContext };
};

describe('saveAggregate', () => {
  it('skips the transaction and the write for a clean aggregate', async () => {
    const { run, asContext } = context();
    const write = vi.fn(async () => {});
    const pullEvents = vi.fn(() => []);

    await saveAggregate(asContext, { isDirty: false, pullEvents }, write);

    expect(run).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(pullEvents).not.toHaveBeenCalled();
  });

  it('writes a dirty aggregate inside one transaction', async () => {
    const { run, asContext } = context();
    const write = vi.fn(async () => {});

    await saveAggregate(asContext, { isDirty: true, pullEvents: () => [] }, write);

    expect(run).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledTimes(1);
  });
});
