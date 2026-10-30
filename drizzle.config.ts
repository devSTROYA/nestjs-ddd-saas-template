import { defineConfig } from 'drizzle-kit';

import { loadEnvFiles } from './src/common/config/load-env-files.js';

loadEnvFiles();

export default defineConfig({
  dialect: 'postgresql',
  schema: ['./src/modules/*/infrastructure/persistence/*.schema.ts', './src/common/*/*.schema.ts'],
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
});
