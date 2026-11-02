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
  createWorkspaceRoleBodySchema,
  createWorkspaceRoleResponseSchema,
  listWorkspaceMembersQuerySchema,
  listWorkspaceMembersResponseSchema,
  listWorkspaceRolesResponseSchema,
  updateWorkspaceRoleBodySchema,
  workspaceResponseSchema,
} from './workspace.schema.js';

const TAG = 'Workspace';
const AUTH_ERRORS = [AuthErrorCodes.UNAUTHENTICATED, AuthErrorCodes.FORBIDDEN] as const;
const WORKSPACE_ID_PARAM = {
  workspaceId: { description: 'Workspace id (UUID v7)', schema: z.uuid({ version: 'v7' }) },
};
const MEMBER_PATH_PARAMS = {
  ...WORKSPACE_ID_PARAM,
  userId: { description: 'User id (UUID v7)', schema: z.uuid({ version: 'v7' }) },
};
const ROLE_PATH_PARAMS = {
  ...WORKSPACE_ID_PARAM,
  roleId: { description: 'Role id (UUID v7)', schema: z.uuid({ version: 'v7' }) },
};
const PERMISSION_ERRORS = [
  WorkspaceErrorCodes.OWNER_REQUIRED,
  WorkspaceErrorCodes.PERMISSION_DENIED,
] as const;

export const workspaceRouteDocs: readonly RouteDoc[] = [
  {
    method: 'get',
    path: '/workspaces/{workspaceId}',
    tag: TAG,
    summary:
      'A workspace of the tenant of the caller, with the caller role, the member count and the newest members',
    auth: 'bearer',
    pathParams: WORKSPACE_ID_PARAM,
    response: {
      status: HttpStatus.OK,
      description: 'The workspace',
      schema: workspaceResponseSchema,
    },
    errors: [
      ...AUTH_ERRORS,
      ValidationErrorCodes.INPUT_INVALID,
      WorkspaceErrorCodes.NOT_FOUND,
      RateLimitErrorCodes.EXCEEDED,
    ],
  },
  {
    method: 'get',
    path: '/workspaces/{workspaceId}/members',
    tag: TAG,
    summary: 'The members of the workspace, newest first, one page at a time',
    auth: 'bearer',
    pathParams: WORKSPACE_ID_PARAM,
    query: listWorkspaceMembersQuerySchema,
    response: {
      status: HttpStatus.OK,
      description: 'A page of members',
      schema: listWorkspaceMembersResponseSchema,
    },
    errors: [
      ...AUTH_ERRORS,
      ValidationErrorCodes.INPUT_INVALID,
      WorkspaceErrorCodes.NOT_FOUND,
      RateLimitErrorCodes.EXCEEDED,
    ],
  },
  {
    method: 'post',
    path: '/workspaces/{workspaceId}/members',
    tag: TAG,
    summary:
      'Add a member (needs workspace-member:add). They become a member at once; an email that is not a user yet becomes one',
    auth: 'bearer',
    pathParams: WORKSPACE_ID_PARAM,
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
      ...PERMISSION_ERRORS,
      WorkspaceErrorCodes.ROLE_NOT_FOUND,
      WorkspaceErrorCodes.MEMBER_ALREADY_EXISTS,
      RateLimitErrorCodes.EXCEEDED,
    ],
  },
  {
    method: 'patch',
    path: '/workspaces/{workspaceId}/members/{userId}',
    tag: TAG,
    summary:
      'Change the role of a member (needs workspace-member:change-role). The last owner cannot be demoted',
    auth: 'bearer',
    pathParams: MEMBER_PATH_PARAMS,
    body: changeWorkspaceMemberRoleBodySchema,
    response: { status: HttpStatus.NO_CONTENT, description: 'Role changed' },
    errors: [
      ...AUTH_ERRORS,
      ValidationErrorCodes.INPUT_INVALID,
      WorkspaceErrorCodes.NOT_FOUND,
      ...PERMISSION_ERRORS,
      WorkspaceErrorCodes.ROLE_NOT_FOUND,
      WorkspaceErrorCodes.MEMBER_NOT_FOUND,
      WorkspaceErrorCodes.LAST_OWNER_REQUIRED,
      RateLimitErrorCodes.EXCEEDED,
    ],
  },
  {
    method: 'delete',
    path: '/workspaces/{workspaceId}/members/{userId}',
    tag: TAG,
    summary:
      'Remove a member (needs workspace-member:remove) and delete their user account, ending their access. The last owner cannot be removed',
    auth: 'bearer',
    pathParams: MEMBER_PATH_PARAMS,
    response: { status: HttpStatus.NO_CONTENT, description: 'Member removed' },
    errors: [
      ...AUTH_ERRORS,
      ValidationErrorCodes.INPUT_INVALID,
      WorkspaceErrorCodes.NOT_FOUND,
      ...PERMISSION_ERRORS,
      WorkspaceErrorCodes.MEMBER_NOT_FOUND,
      WorkspaceErrorCodes.LAST_OWNER_REQUIRED,
      RateLimitErrorCodes.EXCEEDED,
    ],
  },
  {
    method: 'post',
    path: '/workspaces/{workspaceId}/leave',
    tag: TAG,
    summary:
      'Leave the workspace and delete your own user account, ending your access. The last owner cannot leave',
    auth: 'bearer',
    pathParams: WORKSPACE_ID_PARAM,
    response: { status: HttpStatus.NO_CONTENT, description: 'Left the workspace' },
    errors: [
      ...AUTH_ERRORS,
      ValidationErrorCodes.INPUT_INVALID,
      WorkspaceErrorCodes.NOT_FOUND,
      WorkspaceErrorCodes.MEMBER_NOT_FOUND,
      WorkspaceErrorCodes.LAST_OWNER_REQUIRED,
      RateLimitErrorCodes.EXCEEDED,
    ],
  },
  {
    method: 'get',
    path: '/workspaces/{workspaceId}/roles',
    tag: TAG,
    summary: 'The system roles and the custom roles of the workspace, members only',
    auth: 'bearer',
    pathParams: WORKSPACE_ID_PARAM,
    response: {
      status: HttpStatus.OK,
      description: 'The roles',
      schema: listWorkspaceRolesResponseSchema,
    },
    errors: [
      ...AUTH_ERRORS,
      ValidationErrorCodes.INPUT_INVALID,
      WorkspaceErrorCodes.NOT_FOUND,
      RateLimitErrorCodes.EXCEEDED,
    ],
  },
  {
    method: 'post',
    path: '/workspaces/{workspaceId}/roles',
    tag: TAG,
    summary:
      'Create a custom role (needs workspace-role:manage), with only permissions the caller holds',
    auth: 'bearer',
    pathParams: WORKSPACE_ID_PARAM,
    body: createWorkspaceRoleBodySchema,
    response: {
      status: HttpStatus.CREATED,
      description: 'Role created',
      schema: createWorkspaceRoleResponseSchema,
    },
    errors: [
      ...AUTH_ERRORS,
      ValidationErrorCodes.INPUT_INVALID,
      WorkspaceErrorCodes.NOT_FOUND,
      ...PERMISSION_ERRORS,
      WorkspaceErrorCodes.ROLE_KEY_INVALID,
      WorkspaceErrorCodes.ROLE_KEY_TAKEN,
      WorkspaceErrorCodes.ROLE_NAME_INVALID,
      RateLimitErrorCodes.EXCEEDED,
    ],
  },
  {
    method: 'patch',
    path: '/workspaces/{workspaceId}/roles/{roleId}',
    tag: TAG,
    summary:
      'Replace the name and permissions of a custom role (needs workspace-role:manage). System roles cannot be changed',
    auth: 'bearer',
    pathParams: ROLE_PATH_PARAMS,
    body: updateWorkspaceRoleBodySchema,
    response: { status: HttpStatus.NO_CONTENT, description: 'Role updated' },
    errors: [
      ...AUTH_ERRORS,
      ValidationErrorCodes.INPUT_INVALID,
      WorkspaceErrorCodes.NOT_FOUND,
      ...PERMISSION_ERRORS,
      WorkspaceErrorCodes.ROLE_NOT_FOUND,
      WorkspaceErrorCodes.ROLE_SYSTEM,
      WorkspaceErrorCodes.ROLE_NAME_INVALID,
      RateLimitErrorCodes.EXCEEDED,
    ],
  },
  {
    method: 'delete',
    path: '/workspaces/{workspaceId}/roles/{roleId}',
    tag: TAG,
    summary:
      'Delete a custom role that has no members (needs workspace-role:manage). System roles cannot be deleted',
    auth: 'bearer',
    pathParams: ROLE_PATH_PARAMS,
    response: { status: HttpStatus.NO_CONTENT, description: 'Role deleted' },
    errors: [
      ...AUTH_ERRORS,
      ValidationErrorCodes.INPUT_INVALID,
      WorkspaceErrorCodes.NOT_FOUND,
      ...PERMISSION_ERRORS,
      WorkspaceErrorCodes.ROLE_NOT_FOUND,
      WorkspaceErrorCodes.ROLE_SYSTEM,
      WorkspaceErrorCodes.ROLE_IN_USE,
      RateLimitErrorCodes.EXCEEDED,
    ],
  },
];
