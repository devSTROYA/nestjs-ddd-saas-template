import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { Pool } from 'pg';
import { inject } from 'vitest';

import { Email } from '@common/primitives';
import { TenantId } from '@modules/tenants';

import { USER_REPOSITORY, type UserRepository } from './application/ports/user.repository.js';
import { User } from './domain/entities/user.js';
import { UserName } from './domain/value-objects/user-name.js';
import { UsersModule } from './users.module.js';

describe('UsersModule', () => {
  const pool = new Pool({ connectionString: inject('databaseUrl') });
  let moduleRef: TestingModule;

  beforeAll(async () => {
    vi.stubEnv('DATABASE_URL', inject('databaseUrl'));
    vi.stubEnv('OTP_SECRET', 'x'.repeat(32));
    vi.stubEnv('JWT_SECRET', 'y'.repeat(32));
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), UsersModule],
    }).compile();
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await moduleRef.close();
    await pool.end();
  });

  it('provides a repository wired to the configured database', async () => {
    const tenantId = TenantId.create();
    await pool.query("INSERT INTO tenants (id, name) VALUES ($1, 'Wired')", [tenantId.value]);
    const repository = moduleRef.get<UserRepository>(USER_REPOSITORY);
    const user = User.create({
      tenantId,
      email: Email.create('wired@b.co'),
      name: UserName.create('Uz'),
      createdAt: new Date(),
    });

    await repository.save(user);

    expect((await repository.findById(tenantId, user.id))?.email.value).toBe('wired@b.co');
  });
});
