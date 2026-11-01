import { appConfig, docsConfig, loggingConfig } from '@common/config';
import { databaseConfig } from '@common/database';
import { mailConfig } from '@common/mail';
import { otpConfig } from '@common/otp';
import { outboxConfig } from '@common/outbox';
import { adminsConfig } from '@modules/admins';
import { authConfig } from '@modules/auth';

// INFO: Register a new config here (and in OUTBOX_WORKER_CONFIGS if the worker loads its module).
export const APP_CONFIGS = [
  appConfig,
  loggingConfig,
  docsConfig,
  databaseConfig,
  outboxConfig,
  otpConfig,
  mailConfig,
  authConfig,
  adminsConfig,
];

export const OUTBOX_WORKER_CONFIGS = [databaseConfig, outboxConfig];

export const MIGRATE_CONFIGS = [databaseConfig];
