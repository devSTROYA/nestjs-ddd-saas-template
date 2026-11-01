import { HttpStatus } from '@nestjs/common';
import { z } from 'zod';

import type { RouteDoc } from '@common/openapi';
import { PrimitiveErrorCodes } from '@common/primitives';
import { RateLimitErrorCodes } from '@common/rate-limit';
import { ValidationErrorCodes } from '@common/validation';
import { AuthErrorCodes } from '@modules/auth';
import { TenantErrorCodes } from '@modules/tenants';
import { UserErrorCodes } from '@modules/users';

import { InvitationErrorCodes } from '../domain/errors/domain.error.js';
import {
  acceptInvitationBodySchema,
  acceptInvitationResponseSchema,
} from './accept-invitation.schema.js';
import { inviteTenantBodySchema, inviteTenantResponseSchema } from './invite-tenant.schema.js';

const TAG = 'Invitations';

export const invitationRouteDocs: readonly RouteDoc[] = [
  {
    method: 'post',
    path: '/invitations',
    tag: TAG,
    summary:
      'Invite a prospective tenant by email (admin only). Inviting the same email again resends the code',
    auth: 'bearer',
    body: inviteTenantBodySchema,
    response: {
      status: HttpStatus.CREATED,
      description: 'Invitation created and code emailed',
      schema: inviteTenantResponseSchema,
    },
    errors: [
      ValidationErrorCodes.INPUT_INVALID,
      PrimitiveErrorCodes.EMAIL_INVALID,
      InvitationErrorCodes.EMAIL_ALREADY_REGISTERED,
      InvitationErrorCodes.NOT_PENDING,
      AuthErrorCodes.UNAUTHENTICATED,
      AuthErrorCodes.FORBIDDEN,
      RateLimitErrorCodes.EXCEEDED,
    ],
  },
  {
    method: 'post',
    path: '/invitations/{id}/accept',
    tag: TAG,
    summary:
      'Accept an invitation with the emailed OTP and create the tenant, its owner and the workspace',
    pathParams: {
      id: { description: 'Invitation id (UUID v7)', schema: z.uuid({ version: 'v7' }) },
    },
    body: acceptInvitationBodySchema,
    response: {
      status: HttpStatus.CREATED,
      description: 'Tenant and owner created',
      schema: acceptInvitationResponseSchema,
    },
    errors: [
      ValidationErrorCodes.INPUT_INVALID,
      InvitationErrorCodes.NOT_FOUND,
      InvitationErrorCodes.NOT_PENDING,
      InvitationErrorCodes.EXPIRED,
      InvitationErrorCodes.LOCKED,
      InvitationErrorCodes.OTP_INVALID,
      TenantErrorCodes.NAME_EMPTY,
      TenantErrorCodes.NAME_TOO_LONG,
      UserErrorCodes.NAME_EMPTY,
      UserErrorCodes.NAME_TOO_LONG,
      UserErrorCodes.EMAIL_TAKEN,
      RateLimitErrorCodes.EXCEEDED,
    ],
  },
];
