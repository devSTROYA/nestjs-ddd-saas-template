import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { inject } from 'vitest';

import { DatabaseContext } from '@common/database';
import { Email } from '@common/primitives';
import { type TenantId, newTenantId } from '@modules/tenants';

import { LoginChallenge } from '../../domain/entities/login-challenge.js';
import { LoginChallengeAlreadyPendingError } from '../../domain/errors/domain.error.js';
import { newLoginChallengeId } from '../../domain/value-objects/ids.js';
import { LoginChallengeStatus } from '../../domain/value-objects/login-challenge-status.js';
import { DrizzleLoginChallengeRepository } from './drizzle-login-challenge.repository.js';

const NOW = new Date('2026-01-01T00:00:00Z');
const IN_15_MIN = new Date(NOW.getTime() + 15 * 60_000);
const EMAIL = Email.create('root@b.co');

const pool = new Pool({ connectionString: inject('databaseUrl') });
const context = new DatabaseContext(drizzle(pool));
const repository = new DrizzleLoginChallengeRepository(context);

const newChallenge = (tenantId: TenantId | null = null) =>
  LoginChallenge.create(
    { id: newLoginChallengeId(), tenantId, email: EMAIL, otpHash: 'hash', expiresAt: IN_15_MIN },
    NOW,
  );

const insertTenant = async (name: string): Promise<TenantId> => {
  const id = newTenantId();
  await pool.query('INSERT INTO tenants (id, name) VALUES ($1, $2)', [id, name]);
  return id;
};

beforeEach(async () => {
  await pool.query('TRUNCATE TABLE login_challenges, tenants CASCADE');
});

afterAll(async () => {
  await pool.end();
});

describe('DrizzleLoginChallengeRepository', () => {
  it('saves a challenge and finds it as the pending one for its email', async () => {
    const challenge = newChallenge();
    await repository.save(challenge);

    const found = await repository.findPendingByEmail(EMAIL, null);

    expect(found?.id).toBe(challenge.id);
    expect(found?.tenantId).toBeNull();
    expect(found?.email.value).toBe('root@b.co');
    expect(found?.otpHash).toBe('hash');
    expect(found?.expiresAt).toEqual(IN_15_MIN);
    expect(found?.attempts).toBe(0);
    expect(found?.status).toBe(LoginChallengeStatus.PENDING);
  });

  it('returns null when there is no pending challenge', async () => {
    expect(await repository.findPendingByEmail(EMAIL, null)).toBeNull();

    const consumed = newChallenge();
    consumed.verify(true, NOW);
    await repository.save(consumed);
    expect(await repository.findPendingByEmail(EMAIL, null)).toBeNull();
  });

  it('persists attempts and the consumed status', async () => {
    const challenge = newChallenge();
    await repository.save(challenge);

    challenge.verify(false, NOW);
    challenge.verify(true, NOW);
    await repository.save(challenge);

    const { rows } = await pool.query('SELECT attempts, status FROM login_challenges');
    expect(rows).toEqual([{ attempts: 1, status: LoginChallengeStatus.CONSUMED }]);
  });

  it('does not revive a challenge that was consumed after it was read', async () => {
    const challenge = newChallenge();
    await repository.save(challenge);
    const stale = await repository.findPendingByEmail(EMAIL, null);
    challenge.verify(true, NOW);
    await repository.save(challenge);

    stale?.regenerate('new-hash', IN_15_MIN);

    await expect(repository.save(stale as LoginChallenge)).rejects.toThrow(
      LoginChallengeAlreadyPendingError,
    );
    const { rows } = await pool.query('SELECT otp_hash, status FROM login_challenges');
    expect(rows).toEqual([{ otp_hash: 'hash', status: LoginChallengeStatus.CONSUMED }]);
  });

  it('allows only one pending challenge per email', async () => {
    await repository.save(newChallenge());

    await expect(repository.save(newChallenge())).rejects.toThrow(
      LoginChallengeAlreadyPendingError,
    );
  });

  it('allows a new pending challenge once the previous one was consumed', async () => {
    const first = newChallenge();
    first.verify(true, NOW);
    await repository.save(first);

    await repository.save(newChallenge());

    expect(await repository.findPendingByEmail(EMAIL, null)).not.toBeNull();
  });

  it('finds the pending challenge for update inside a transaction', async () => {
    await repository.save(newChallenge());

    const found = await context.run(() => repository.findPendingByEmailForUpdate(EMAIL, null));

    expect(found?.email.value).toBe('root@b.co');
  });

  it('keeps challenges apart per tenant and from admin challenges', async () => {
    const acme = await insertTenant('acme');
    const beta = await insertTenant('beta');
    const admin = newChallenge();
    const inAcme = newChallenge(acme);
    await repository.save(admin);
    await repository.save(inAcme);
    await repository.save(newChallenge(beta));

    expect((await repository.findPendingByEmail(EMAIL, null))?.id).toBe(admin.id);
    expect((await repository.findPendingByEmail(EMAIL, acme))?.id).toBe(inAcme.id);
    expect((await repository.findPendingByEmail(EMAIL, acme))?.tenantId).toBe(acme);
  });

  it('allows only one pending challenge per email within a tenant', async () => {
    const acme = await insertTenant('acme');
    await repository.save(newChallenge(acme));

    await expect(repository.save(newChallenge(acme))).rejects.toThrow(
      LoginChallengeAlreadyPendingError,
    );
  });
});
