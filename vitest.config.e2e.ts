import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    env: {
      DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/boilerplate_e2e',
      OTP_SECRET: 'e2e-otp-secret-with-at-least-32-characters',
      JWT_SECRET: 'e2e-jwt-secret-with-at-least-32-characters',
    },
  },
});
