import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { DatabaseModule } from './database.module.js';

describe('DatabaseModule', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('fails at boot naming DATABASE_URL when it is missing', async () => {
    vi.stubEnv('DATABASE_URL', undefined);

    await expect(
      Test.createTestingModule({
        imports: [ConfigModule.forRoot({ ignoreEnvFile: true }), DatabaseModule],
      }).compile(),
    ).rejects.toThrow(/Invalid database config[\s\S]*DATABASE_URL/);
  });
});
