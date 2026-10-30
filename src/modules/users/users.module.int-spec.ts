import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { Pool } from 'pg';
import { inject } from 'vitest';

import { validateEnv } from '@common/config';
import { Email } from '@common/primitives';
import { newTenantId } from '@modules/tenants';

import { USER_REPOSITORY, type UserRepository } from './application/ports/user.repository.js';
import { User } from './domain/entities/user.js';
import { newUserId } from './domain/value-objects/user-id.js';
import { UserName } from './domain/value-objects/user-name.js';
import { UsersModule } from './users.module.js';

describe('UsersModule', () => {
  const pool = new Pool({ connectionString: inject('databaseUrl') });
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          validate: () =>
            validateEnv({
              DATABASE_URL: inject('databaseUrl'),
              OTP_SECRET: 'x'.repeat(32),
              JWT_SECRET: 'y'.repeat(32),
            }),
        }),
        UsersModule,
      ],
    }).compile();
  });

  afterAll(async () => {
    await moduleRef.close();
    await pool.end();
  });

  it('provides a repository wired to the configured database', async () => {
    const tenantId = newTenantId();
    await pool.query("INSERT INTO tenants (id, name) VALUES ($1, 'Wired')", [tenantId]);
    const repository = moduleRef.get<UserRepository>(USER_REPOSITORY);
    const user = User.create({
      id: newUserId(),
      tenantId,
      email: Email.create('wired@b.co'),
      name: UserName.create('Uz'),
    });

    await repository.save(user);

    expect((await repository.findById(tenantId, user.id))?.email.value).toBe('wired@b.co');
  });
});
