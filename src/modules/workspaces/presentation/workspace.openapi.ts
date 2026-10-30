import { HttpStatus } from '@nestjs/common';
import { z } from 'zod';

import type { RouteDoc } from '@common/openapi';
import { PrimitiveErrorCodes } from '@common/primitives';
import { RateLimitErrorCodes } from '@common/rate-limit';
import { ValidationErrorCodes } from '@common/validation';
import { AuthErrorCodes } from '@modules/auth';
import { UserErrorCodes } from '@modules/users';

import { WorkspaceErrorCodes } from '../domain/errors/domain.error.js';
import {
  addWorkspaceMemberBodySchema,
  addWorkspaceMemberResponseSchema,
  changeWorkspaceMemberRoleBodySchema,
  workspaceResponseSchema,
} from './workspace.schema.js';

const TAG = 'Workspace';
const AUTH_ERRORS = [AuthErrorCodes.UNAUTHENTICATED, AuthErrorCodes.FORBIDDEN] as const;
const USER_ID_PARAM = {
  userId: { description: 'User id (UUID v7)', schema: z.uuid({ version: 'v7' }) },
};

export const workspaceRouteDocs: readonly RouteDoc[] = [
  {
    method: 'get',
    path: '/workspace',
    tag: TAG,
    summary: 'The workspace of the tenant of the caller, with its members and the caller role',
    auth: 'bearer',
    response: {
      status: HttpStatus.OK,
      description: 'The workspace',
      schema: workspaceResponseSchema,
    },
    errors: [...AUTH_ERRORS, WorkspaceErrorCodes.NOT_FOUND, RateLimitErrorCodes.EXCEEDED],
  },
  {
    method: 'post',
    path: '/workspace/members',
    tag: TAG,
    summary:
      'Add a member (owners only). They become a member at once; an email that is not a user yet becomes one',
    auth: 'bearer',
    body: addWorkspaceMemberBodySchema,
    response: {
      status: HttpStatus.CREATED,
      description: 'Member added',
      schema: addWorkspaceMemberResponseSchema,
    },
    errors: [
      ...AUTH_ERRORS,
      ValidationErrorCodes.INPUT_INVALID,
      PrimitiveErrorCodes.EMAIL_INVALID,
      UserErrorCodes.NAME_EMPTY,
      UserErrorCodes.NAME_TOO_LONG,
      UserErrorCodes.EMAIL_TAKEN,
      WorkspaceErrorCodes.NOT_FOUND,
      WorkspaceErrorCodes.OWNER_REQUIRED,
      WorkspaceErrorCodes.MEMBER_ALREADY_EXISTS,
      RateLimitErrorCodes.EXCEEDED,
    ],
  },
  {
    method: 'patch',
    path: '/workspace/members/{userId}',
    tag: TAG,
    summary: 'Change the role of a member (owners only). The last owner cannot be demoted',
    auth: 'bearer',
    pathParams: USER_ID_PARAM,
    body: changeWorkspaceMemberRoleBodySchema,
    response: { status: HttpStatus.NO_CONTENT, description: 'Role changed' },
    errors: [
      ...AUTH_ERRORS,
      ValidationErrorCodes.INPUT_INVALID,
      PrimitiveErrorCodes.ID_INVALID,
      WorkspaceErrorCodes.NOT_FOUND,
      WorkspaceErrorCodes.OWNER_REQUIRED,
      WorkspaceErrorCodes.MEMBER_NOT_FOUND,
      WorkspaceErrorCodes.LAST_OWNER_REQUIRED,
      RateLimitErrorCodes.EXCEEDED,
    ],
  },
  {
    method: 'delete',
    path: '/workspace/members/{userId}',
    tag: TAG,
    summary:
      'Remove a member (owners only) and delete their user account, ending their access. The last owner cannot be removed',
    auth: 'bearer',
    pathParams: USER_ID_PARAM,
    response: { status: HttpStatus.NO_CONTENT, description: 'Member removed' },
    errors: [
      ...AUTH_ERRORS,
      PrimitiveErrorCodes.ID_INVALID,
      WorkspaceErrorCodes.NOT_FOUND,
      WorkspaceErrorCodes.OWNER_REQUIRED,
      WorkspaceErrorCodes.MEMBER_NOT_FOUND,
      WorkspaceErrorCodes.LAST_OWNER_REQUIRED,
      RateLimitErrorCodes.EXCEEDED,
    ],
  },
  {
    method: 'post',
    path: '/workspace/leave',
    tag: TAG,
    summary:
      'Leave the workspace and delete your own user account, ending your access. The last owner cannot leave',
    auth: 'bearer',
    response: { status: HttpStatus.NO_CONTENT, description: 'Left the workspace' },
    errors: [
      ...AUTH_ERRORS,
      WorkspaceErrorCodes.NOT_FOUND,
      WorkspaceErrorCodes.MEMBER_NOT_FOUND,
      WorkspaceErrorCodes.LAST_OWNER_REQUIRED,
      RateLimitErrorCodes.EXCEEDED,
    ],
  },
];
