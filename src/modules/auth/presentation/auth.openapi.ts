import { HttpStatus } from '@nestjs/common';

import type { RouteDoc } from '@common/openapi';
import { PrimitiveErrorCodes } from '@common/primitives';
import { RateLimitErrorCodes } from '@common/rate-limit';
import { ValidationErrorCodes } from '@common/validation';

import { AuthErrorCodes } from '../domain/errors/domain.error.js';
import {
  refreshBodySchema,
  requestAdminLoginBodySchema,
  requestUserLoginBodySchema,
  tokenResponseSchema,
  verifyAdminLoginBodySchema,
  verifyUserLoginBodySchema,
} from './auth.schema.js';

const TAG = 'Auth';

export const authRouteDocs: readonly RouteDoc[] = [
  {
    method: 'post',
    path: '/auth/admin/otp',
    tag: TAG,
    summary:
      'Email a one-time code to an admin. Always answers 202, whether or not the email is an admin',
    body: requestAdminLoginBodySchema,
    response: { status: HttpStatus.ACCEPTED, description: 'Accepted' },
    errors: [
      ValidationErrorCodes.INPUT_INVALID,
      PrimitiveErrorCodes.EMAIL_INVALID,
      RateLimitErrorCodes.EXCEEDED,
    ],
  },
  {
    method: 'post',
    path: '/auth/admin/token',
    tag: TAG,
    summary: 'Exchange the emailed one-time code for an access token and a refresh token',
    body: verifyAdminLoginBodySchema,
    response: {
      status: HttpStatus.OK,
      description: 'Tokens issued',
      schema: tokenResponseSchema,
    },
    errors: [
      ValidationErrorCodes.INPUT_INVALID,
      PrimitiveErrorCodes.EMAIL_INVALID,
      AuthErrorCodes.CREDENTIALS_INVALID,
      RateLimitErrorCodes.EXCEEDED,
    ],
  },
  {
    method: 'post',
    path: '/auth/user/otp',
    tag: TAG,
    summary:
      'Email a one-time code to a tenant user. Always answers 202, whether or not the email is a user',
    body: requestUserLoginBodySchema,
    response: { status: HttpStatus.ACCEPTED, description: 'Accepted' },
    errors: [
      ValidationErrorCodes.INPUT_INVALID,
      PrimitiveErrorCodes.EMAIL_INVALID,
      RateLimitErrorCodes.EXCEEDED,
    ],
  },
  {
    method: 'post',
    path: '/auth/user/token',
    tag: TAG,
    summary:
      'Exchange the emailed one-time code for an access token and a refresh token of a tenant user',
    body: verifyUserLoginBodySchema,
    response: {
      status: HttpStatus.OK,
      description: 'Tokens issued',
      schema: tokenResponseSchema,
    },
    errors: [
      ValidationErrorCodes.INPUT_INVALID,
      PrimitiveErrorCodes.EMAIL_INVALID,
      AuthErrorCodes.CREDENTIALS_INVALID,
      RateLimitErrorCodes.EXCEEDED,
    ],
  },
  {
    method: 'post',
    path: '/auth/refresh',
    tag: TAG,
    summary:
      'Rotate a refresh token. Reusing a refresh token that was already used revokes the whole session',
    body: refreshBodySchema,
    response: {
      status: HttpStatus.OK,
      description: 'Tokens rotated',
      schema: tokenResponseSchema,
    },
    errors: [
      ValidationErrorCodes.INPUT_INVALID,
      AuthErrorCodes.REFRESH_TOKEN_INVALID,
      RateLimitErrorCodes.EXCEEDED,
    ],
  },
  {
    method: 'post',
    path: '/auth/logout',
    tag: TAG,
    summary: 'Revoke the session behind a refresh token. Unknown tokens are ignored',
    body: refreshBodySchema,
    response: { status: HttpStatus.NO_CONTENT, description: 'Session revoked' },
    errors: [ValidationErrorCodes.INPUT_INVALID, RateLimitErrorCodes.EXCEEDED],
  },
];
