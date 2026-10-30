import { mailErrorStatus, type MailErrorCode } from '@common/mail';
import { primitiveErrorStatus, type PrimitiveErrorCode } from '@common/primitives';
import { rateLimitErrorStatus, type RateLimitErrorCode } from '@common/rate-limit';
import { validationErrorStatus, type ValidationErrorCode } from '@common/validation';
import { adminErrorStatus, type AdminErrorCode } from '@modules/admins';
import { authErrorStatus, type AuthErrorCode } from '@modules/auth';
import { invitationErrorStatus, type InvitationErrorCode } from '@modules/invitations';
import { tenantErrorStatus, type TenantErrorCode } from '@modules/tenants';
import { userErrorStatus, type UserErrorCode } from '@modules/users';
import { workspaceErrorStatus, type WorkspaceErrorCode } from '@modules/workspaces';
import { healthErrorStatus, type HealthErrorCode } from './health/health.error.js';

export const errorStatus = {
  ...mailErrorStatus,
  ...primitiveErrorStatus,
  ...rateLimitErrorStatus,
  ...validationErrorStatus,
  ...healthErrorStatus,
  ...adminErrorStatus,
  ...authErrorStatus,
  ...invitationErrorStatus,
  ...tenantErrorStatus,
  ...userErrorStatus,
  ...workspaceErrorStatus,
} as const satisfies Record<
  | MailErrorCode
  | PrimitiveErrorCode
  | RateLimitErrorCode
  | ValidationErrorCode
  | HealthErrorCode
  | AdminErrorCode
  | AuthErrorCode
  | InvitationErrorCode
  | TenantErrorCode
  | UserErrorCode
  | WorkspaceErrorCode,
  number
>;
