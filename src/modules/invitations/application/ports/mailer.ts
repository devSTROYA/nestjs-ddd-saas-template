import type { Email } from '@common/primitives';

import type { InvitationId } from '../../domain/value-objects/invitation-id.js';

export interface Mailer {
  sendInvitationOtp(message: {
    to: Email;
    invitationId: InvitationId;
    otp: string;
    expiresAt: Date;
  }): Promise<void>;
}

export const MAILER = Symbol('MAILER');
