import { buildOpenApiDocument } from '@common/openapi';
import { authRouteDocs } from '@modules/auth';
import { invitationRouteDocs } from '@modules/invitations';
import { workspaceRouteDocs } from '@modules/workspaces';

import { API_PREFIX } from './api-prefix.js';
import { errorStatus } from './error-status.js';
import { healthRouteDocs } from './health/health.openapi.js';

export const apiRouteDocs = [
  ...healthRouteDocs,
  ...authRouteDocs,
  ...invitationRouteDocs,
  ...workspaceRouteDocs,
];

export const apiDocument = buildOpenApiDocument(
  { title: 'Boilerplate API', version: '1.0.0', serverUrl: `/${API_PREFIX}` },
  apiRouteDocs,
  errorStatus,
);
