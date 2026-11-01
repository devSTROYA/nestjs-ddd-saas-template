import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { inject } from 'vitest';

import { DatabaseContext } from '@common/database';
import { Email } from '@common/primitives';
import { AdminId } from '@modules/admins';

import { Invitation } from '../../domain/entities/invitation.js';
import {
  InvalidInvitationStatusError,
  InvitationAlreadyPendingError,
  InvitationNotPendingError,
} from '../../domain/errors/domain.error.js';
import { InvitationEventNames } from '../../domain/events/invitation.events.js';
import { InvitationId } from '../../domain/value-objects/invitation-id.js';
import { InvitationStatus } from '../../domain/value-objects/invitation-status.js';
import { DrizzleInvitationRepository } from './drizzle-invitation.repository.js';

const ADMIN_ID = AdminId.create();
const NOW = new Date('2026-01-01T00:00:00Z');
const IN_15_MIN = new Date(NOW.getTime() + 15 * 60_000);

const pool = new Pool({ connectionString: inject('databaseUrl') });
const context = new DatabaseContext(drizzle(pool));
const repository = new DrizzleInvitationRepository(context);

const newInvitation = (email = 'a@b.co') =>
  Invitation.create({
    email: Email.create(email),
    invitedBy: ADMIN_ID,
    otpHash: 'hash',
    expiresAt: IN_15_MIN,
    createdAt: NOW,
  });

beforeEach(async () => {
  await pool.query('TRUNCATE TABLE outbox, invitations, admins CASCADE');
  await pool.query("INSERT INTO admins (id, email) VALUES ($1, 'root@b.co')", [ADMIN_ID.value]);
});

afterAll(async () => {
  await pool.end();
});

describe('DrizzleInvitationRepository', () => {
  it('saves and reads an invitation back by id', async () => {
    const invitation = newInvitation();
    await repository.save(invitation);

    const found = await repository.findById(invitation.id);

    expect(found?.id).toEqual(invitation.id);
    expect(found?.email.value).toBe('a@b.co');
    expect(found?.invitedBy).toEqual(ADMIN_ID);
    expect(found?.otpHash).toBe('hash');
    expect(found?.expiresAt).toEqual(IN_15_MIN);
    expect(found?.attempts).toBe(0);
    expect(found?.status).toBe(InvitationStatus.PENDING);
    expect(found?.createdAt).toEqual(NOW);
  });

  it('writes the pending events to the outbox with the invitation', async () => {
    const invitation = newInvitation();
    await repository.save(invitation);

    const { rows } = await pool.query<{ name: string; aggregate_id: string; tenant_id: null }>(
      'SELECT name, aggregate_id, tenant_id FROM outbox',
    );
    expect(rows).toEqual([
      { name: InvitationEventNames.CREATED, aggregate_id: invitation.id.value, tenant_id: null },
    ]);
  });

  it('leaves neither the invitation nor its outbox row when the transaction fails', async () => {
    const invitation = newInvitation();

    await expect(
      context.run(async () => {
        await repository.save(invitation);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(await repository.findById(invitation.id)).toBeNull();
    const { rows } = await pool.query('SELECT 1 FROM outbox');
    expect(rows).toHaveLength(0);
  });

  it('returns null when nothing matches', async () => {
    expect(await repository.findById(InvitationId.create())).toBeNull();
    expect(await repository.findPendingByEmail(Email.create('x@y.co'))).toBeNull();
  });

  it('persists attempts, status and a regenerated otp on save', async () => {
    const invitation = newInvitation();
    await repository.save(invitation);

    invitation.accept(false, NOW);
    invitation.regenerate('hash2', new Date(IN_15_MIN.getTime() + 1000), NOW);
    invitation.accept(false, NOW);
    invitation.accept(true, NOW);
    await repository.save(invitation);

    const found = await repository.findById(invitation.id);
    expect(found?.otpHash).toBe('hash2');
    expect(found?.attempts).toBe(1);
    expect(found?.status).toBe(InvitationStatus.ACCEPTED);
  });

  it('does not revive an invitation that was accepted after it was read', async () => {
    const invitation = newInvitation();
    await repository.save(invitation);
    const stale = await repository.findById(invitation.id);
    invitation.accept(true, NOW);
    await repository.save(invitation);

    stale?.regenerate('hash2', new Date(IN_15_MIN.getTime() + 1000), NOW);

    await expect(repository.save(stale as Invitation)).rejects.toThrow(InvitationNotPendingError);
    const found = await repository.findById(invitation.id);
    expect(found?.status).toBe(InvitationStatus.ACCEPTED);
    expect(found?.otpHash).toBe('hash');
  });

  it('finds only the pending invitation for an email', async () => {
    const accepted = newInvitation();
    accepted.accept(true, NOW);
    await repository.save(accepted);
    expect(await repository.findPendingByEmail(accepted.email)).toBeNull();

    const pending = newInvitation();
    await repository.save(pending);
    expect((await repository.findPendingByEmail(pending.email))?.id).toEqual(pending.id);
  });

  it('allows only one pending invitation per email', async () => {
    await repository.save(newInvitation());

    await expect(repository.save(newInvitation())).rejects.toThrow(InvitationAlreadyPendingError);
  });

  it('allows a new pending invitation after the previous one was accepted or revoked', async () => {
    const first = newInvitation();
    first.revoke(NOW);
    await repository.save(first);

    await repository.save(newInvitation());

    expect(await repository.findPendingByEmail(Email.create('a@b.co'))).not.toBeNull();
  });

  it('requires the inviting admin to exist', async () => {
    const orphan = Invitation.create({
      email: Email.create('a@b.co'),
      invitedBy: AdminId.create(),
      otpHash: 'hash',
      expiresAt: IN_15_MIN,
      createdAt: NOW,
    });

    await expect(repository.save(orphan)).rejects.toMatchObject({ cause: { code: '23503' } });
  });

  it('fails loudly when the stored status is unknown', async () => {
    const id = InvitationId.create();
    await pool.query(
      `INSERT INTO invitations (id, email, invited_by, otp_hash, expires_at, status)
       VALUES ($1, 'z@b.co', $2, 'hash', $3, 'weird')`,
      [id.value, ADMIN_ID.value, IN_15_MIN],
    );

    await expect(repository.findById(id)).rejects.toThrow(InvalidInvitationStatusError);
  });
});
