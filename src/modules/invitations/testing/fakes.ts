import type { Email } from '@common/primitives';
import type { UnitOfWork } from '@common/database';
import type { Clock } from '@common/clock';
import type { Nullable } from '@common/types';
import type { Tenant, TenantId, TenantRepository } from '@modules/tenants';
import type { User, UserId, UserRepository } from '@modules/users';
import type { Workspace, WorkspaceId, WorkspaceRepository } from '@modules/workspaces';

import type { InvitationRepository } from '../application/ports/invitation.repository.js';
import type { Mailer } from '../application/ports/mailer.js';
import type { OtpService } from '@common/otp';
import type { Invitation } from '../domain/entities/invitation.js';
import type { InvitationId } from '../domain/value-objects/invitation-id.js';
import { InvitationStatus } from '../domain/value-objects/invitation-status.js';

export class FakeInvitations implements InvitationRepository {
  readonly saved = new Map<string, Invitation>();
  saves = 0;

  findById(id: InvitationId): Promise<Nullable<Invitation>> {
    return Promise.resolve(this.saved.get(id.value) ?? null);
  }

  findByIdForUpdate(id: InvitationId): Promise<Nullable<Invitation>> {
    return this.findById(id);
  }

  findPendingByEmail(email: Email): Promise<Nullable<Invitation>> {
    const found = [...this.saved.values()].find(
      (invitation) =>
        invitation.email.equals(email) && invitation.status === InvitationStatus.PENDING,
    );
    return Promise.resolve(found ?? null);
  }

  save(invitation: Invitation): Promise<void> {
    this.saved.set(invitation.id.value, invitation);
    this.saves += 1;
    return Promise.resolve();
  }
}

export class FakeTenants implements TenantRepository {
  readonly saved = new Map<string, Tenant>();

  findById(id: TenantId): Promise<Nullable<Tenant>> {
    return Promise.resolve(this.saved.get(id.value) ?? null);
  }

  save(tenant: Tenant): Promise<void> {
    this.saved.set(tenant.id.value, tenant);
    return Promise.resolve();
  }
}

export class FakeUsers implements UserRepository {
  readonly saved: User[] = [];

  findById(): Promise<Nullable<User>> {
    return Promise.resolve(null);
  }

  findByEmail(email: Email): Promise<Nullable<User>> {
    return Promise.resolve(this.saved.find((user) => user.email.equals(email)) ?? null);
  }

  save(user: User): Promise<void> {
    this.saved.push(user);
    return Promise.resolve();
  }

  delete(tenantId: TenantId, id: UserId): Promise<void> {
    const index = this.saved.findIndex(
      (user) => user.id.equals(id) && user.tenantId.equals(tenantId),
    );
    if (index >= 0) {
      this.saved.splice(index, 1);
    }
    return Promise.resolve();
  }
}

export class FakeWorkspaces implements WorkspaceRepository {
  readonly saved = new Map<string, Workspace>();

  findById(tenantId: TenantId, id: WorkspaceId): Promise<Nullable<Workspace>> {
    const found = this.saved.get(id.value);
    return Promise.resolve(found?.tenantId.equals(tenantId) ? found : null);
  }

  findByIdForUpdate(tenantId: TenantId, id: WorkspaceId): Promise<Nullable<Workspace>> {
    return this.findById(tenantId, id);
  }

  save(workspace: Workspace): Promise<void> {
    this.saved.set(workspace.id.value, workspace);
    return Promise.resolve();
  }
}

export class FakeMailer implements Mailer {
  readonly sent: Parameters<Mailer['sendInvitationOtp']>[0][] = [];

  sendInvitationOtp(message: Parameters<Mailer['sendInvitationOtp']>[0]): Promise<void> {
    this.sent.push(message);
    return Promise.resolve();
  }
}

export const OTP = '123456';

export const fakeOtpService: OtpService = {
  generate: () => OTP,
  hash: (invitationId, otp) => `hash:${invitationId}:${otp}`,
  matches: (invitationId, otp, hash) => hash === `hash:${invitationId}:${otp}`,
};

export const fakeUnitOfWork: UnitOfWork = {
  run: (work) => work(),
};

export const fixedClock = (now: Date): Clock => ({ now: () => now });
