import { Email } from '@common/primitives';

import { Admin } from '../domain/entities/admin.js';
import { toAdminId } from '../domain/value-objects/admin-id.js';
import type { AdminRepository } from './ports/admin.repository.js';

export const SEED_ADMIN_ID = toAdminId('00000000-0000-7000-8000-000000000001');

type SeedAdminResult = 'created' | 'updated' | 'unchanged';

export async function seedAdmin(
  repository: AdminRepository,
  rawEmail: string,
): Promise<SeedAdminResult> {
  const email = Email.create(rawEmail);
  const existing = await repository.findById(SEED_ADMIN_ID);

  if (!existing) {
    await repository.save(Admin.create({ email }, SEED_ADMIN_ID));
    return 'created';
  }
  if (existing.email.equals(email)) {
    return 'unchanged';
  }
  existing.changeEmail(email);
  await repository.save(existing);
  return 'updated';
}
