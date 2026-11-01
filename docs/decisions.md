# Technical decisions and conventions

Why the code is written the way it is. Each entry has the decision and the reason. When a decision
changes, update this file in the same change.

## Stack and tooling

- **NestJS 12, TypeScript (strict), pnpm, Vitest, oxlint, Prettier.** Scaffold defaults, kept.
- **Prettier: single quotes and `printWidth: 100`, otherwise defaults.** Single quotes are the common
  TypeScript community style (and the NestJS scaffold's). 100 columns because the code uses long
  type names. `pnpm format` also covers the root `*.ts` files.
- **Builder: SWC** (`nest-cli.json`: `builder: swc`, `typeCheck: true`; `.swcrc`). Much faster than
  `tsc` for `nest build` and `nest start --watch`; `typeCheck` still runs `tsc` for diagnostics, and
  `tsc --noEmit` stays the typecheck step. SWC does not rewrite `tsconfig` paths, so `.swcrc` repeats
  the `@common/*` and `@modules/*` aliases (keep it in sync with `tsconfig.json`) and sets
  `resolveFully` so relative imports get their `.js` extension. Legacy decorators and decorator
  metadata are enabled for Nest. `@swc/core` is installed without its install script
  (`allowBuilds: false`): the platform binary comes from an optional dependency. Vitest keeps its
  own transform and is unaffected.
- **Drizzle ORM + PostgreSQL (`pg` driver).** SQL stays explicit, schema is plain TypeScript, and
  mapping rows to aggregates is natural. Prisma and TypeORM were rejected because they shape query
  results or entities in ways that fight a domain model.
- **HTTP platform: Fastify, used natively** (`@nestjs/platform-fastify`, no Express compatibility
  layer). Types come from `fastify` (`FastifyReply` in the error filter, `NestFastifyApplication`).
  The server listens on `0.0.0.0` (Fastify defaults to localhost only, which breaks containers). In
  tests, boot with `FastifyAdapter` and `await app.getHttpAdapter().getInstance().ready()` before
  using `supertest`.
- **Config: `@nestjs/config` + zod, one `registerAs` namespace per owner.** Each module owns the env
  vars it uses in a `<name>.config.ts` next to it (`database`, `outbox`, `otp`, `mail`, `auth`,
  `admins`; the app-level `app`, `logging`, `docs` live in `src/common/config`). The file holds a
  zod schema and `registerAs('<name>', () => parseConfig('<name>', schema))` returning a camelCase
  object. The owning module imports `ConfigModule.forFeature(xConfig)` and injects it typed:
  `@Inject(xConfig.KEY) config: ConfigType<typeof xConfig>`. `ConfigModule.forRoot` (in `AppModule`
  and `OutboxWorkerModule`) only loads the `.env` files into `process.env`; it has no `validate`.
  Every entrypoint (`main.ts`, `seed.ts`, `outbox-worker.ts`, `migrate.ts`) first runs
  `checkConfigOrExit(<list from src/config-sets.ts>)` before the Nest app exists: it runs all the
  listed factories, logs one report through Nest's `Logger` (`Invalid configuration: N errors in M
  variables`, then per namespace one line per error: `  ENV is required` for a missing variable,
  `  ENV: validator message` otherwise, then a `.env.example` hint) and calls
  `process.exit(1)` with no stack trace. `runEntrypoint` logs any other startup failure once and
  exits 1. Validation at module load stays as the safety net: `parseConfig` throws a
  `ConfigValidationError` (`Invalid <name> config:` plus the variable name), and only the
  namespaces of modules that are loaded are validated. A new config must be added to the lists in
  `src/config-sets.ts` of every entrypoint whose module graph loads it. `main.ts` calls `appConfig()` directly for `TRUST_PROXY_HOPS` before the Nest app
  exists. Nothing outside `src/common/config` and the `*.config.ts` files reads `process.env`
  (`drizzle.config.ts` is tooling and reads `DATABASE_URL` itself). To add a variable: put it in the
  schema of the owning `*.config.ts` (create the file and `forFeature` import if the module has
  none), expose it on the returned object, add it to `.env.example`, and extend that config's spec;
  `src/env-example.spec.ts` fails if `.env.example` and the schemas drift. Required: `DATABASE_URL`,
  `OTP_SECRET`, `JWT_SECRET`; optional: `ADMIN_SEED_EMAIL`; defaults for `NODE_ENV` and `PORT`.
- **Environment files** (`envFilePaths`, used by `ConfigModule` and `drizzle.config.ts`): the
  runtime environment variables win, then `.env.<NODE_ENV>.local` (`.env.development.local` for
  development, `.env.test.local` for tests), then `.env` as the default that is closest to
  production. `NODE_ENV` is not set inside the files: the runner sets it (`start:prod` sets
  `production`, Vitest sets `test`, and it falls back to `development`). Real env files are
  git-ignored; `.env.example` is the only example file, since every env file has the same keys.
- **Integration tests use embedded Postgres** (`embedded-postgres`), not containers. No Docker or
  Podman needed. `pnpm-workspace.yaml` allows the postinstall of
  `@embedded-postgres/darwin-arm64` only (it creates symlinks inside its own package). That package is
  Apple Silicon only; other platforms need their own `@embedded-postgres/*` package.

## Project layout

- **Layered per module:** `src/modules/<module>/{domain,application,infrastructure,presentation}`,
  one folder per use-case under `application/`.
- **File names are flat, with no role suffix for domain objects:** an entity is `invitation.ts` (not
  `invitation.entity.ts`), exactly like its value objects `invitation-id.ts` and
  `invitation-status.ts`. Class names do not change (`Invitation`). Suffixes are kept for technical
  artifacts (`.module`, `.controller`, `.guard`, `.schema`, `.spec`).
- **Shared code in `src/common`** (config, database, errors, primitives), imported through the
  aliases `@common/*` and `@modules/*` (see `tsconfig.json`). Each folder has an `index.ts` barrel.
- **Cross-module imports go through the other module's barrel** (`@modules/tenants`), never through
  deep paths. Exceptions: Drizzle schema files import each other by relative path, because
  `drizzle-kit` does not resolve `tsconfig` aliases (used for foreign keys); and a `*.module.ts`
  imports another module's Nest module by relative path (`../users/users.module.js`), because the
  barrels export no Nest modules (that would pull each module's controllers into every importer).
- **Composition root:** `src/app.module.ts` wires modules, and `src/error-status.ts` merges every
  module's error-status map.
- **`common/primitives`** holds small shared value objects (`Email`, UUID v7 helpers) and their
  errors. The name was kept on purpose.

## Domain modelling

- **Aggregates have a private constructor** with two factories: `create` validates and builds a new
  instance, `restore` rebuilds from storage without re-validating (so old rows that violate new rules
  can still be loaded).
- **Value objects only where there is a real rule:** `Email`, `UserName`, `TenantName`. They follow
  the same `create` / `restore` / `equals` shape. Names have a max length that matches the column.
- **Ids are classes holding a UUID v7.** Every id extends `UuidV7Id` and has the same shape as the other
  value objects: `XId.restore(value)` validates (throws `ID_INVALID`), `XId.create()` generates,
  `.value` is the plain uuid. A private brand member keeps each id nominal, so a `UserId` is not a
  `TenantId`. `equals` is true only for the same class and value, so never compare ids with `===`, and
  never key a `Map`, `Set` or object by an id: use `.value`. `toJSON` and `toString` return the uuid, so
  JSON responses are unchanged. Plain strings are used only at the edges: database columns and Drizzle
  (`id.value`, rows mapped back with `XId.restore`), domain event payloads, JWT and principal payloads,
  and request params and bodies (controllers call `XId.restore`). Aggregate factories generate their
  own id; only `Admin`, `Invitation` and `LoginChallenge` take an optional trailing id (fixed seed id,
  OTP hash bound to the id).
- **Time:** `Invitation.create` receives `now` so tests control it. `User`, `Tenant`, `Admin` and
  `Workspace` still use `new Date()` inside `create` (known gap, see the end of this file).
- **Email validation:** WHATWG-style pattern after trimming and lowercasing, total length at most 254
  and local part at most 64. It deliberately also requires a dot in the domain and rejects leading,
  trailing or repeated dots in the local part. Not supported: international addresses and quoted
  local parts. This only checks shape; ownership is proved by the OTP.

## Multi-tenancy and onboarding

- **A user belongs to exactly one tenant** (`users.tenant_id`, `NOT NULL`), and **a user email is
  unique across all tenants** (`uq_users_email`). That is what lets a user log in with just their
  email. `UserRepository.findByEmail(email)` therefore takes no tenant, the one exception to
  "explicit tenant id". A tenant is treated as a single workspace for now.
- **`tenant_id` is passed explicitly to every repository method** that reads or writes tenant data,
  and every query filters on it. Explicit is easier to audit than an ambient tenant.
- **`users.tenant_id` has a foreign key to `tenants.id` with `ON DELETE RESTRICT`**: a tenant cannot
  be deleted while it still has users. (Postgres reports this as `23001`, not `23503`.)
- **Registration is closed.** Only a platform admin can invite a prospective tenant. Accepting the
  invitation creates the tenant and its first (owner) user in one transaction. The invitation has no
  tenant; the invitee names the tenant (and their own name) on accept.
- **No tenant slug.** One was added and removed again (migrations 0008 and 0009) once login became
  email only: a slug has no other use yet. Bring it back when subdomains or URLs need it.
- **Inviting an email that already belongs to a user is refused** (`409
  INVITATION_EMAIL_ALREADY_REGISTERED`), at invite time so the admin knows before any mail is sent.
  Accept still maps a unique violation to `USER_EMAIL_TAKEN` as the race-safe fallback.
- **Workspaces** (`src/modules/workspaces`). Accepting an invitation also creates the tenant's
  workspace (named after the tenant) with the new user as its owner, in the same transaction. A
  tenant has exactly one workspace for now (`uq_workspaces_tenant_id`; drop that index to allow
  several). The API is `/v1/workspaces/:workspaceId/...` and takes the tenant from the access token
  only; a workspace id of another tenant or an unknown id is `404 WORKSPACE_NOT_FOUND`
  (`findById(tenantId, id)` never finds it).
  - `Workspace` is an aggregate holding its members (`user -> role`); roles are `owner` and `admin`
    (`WorkspaceRole`). `workspace_members` (pk `workspace_id, user_id`) cascades with the workspace;
    the repository makes the stored members equal to the aggregate's and locks the workspace row
    (`FOR UPDATE`) for every change, so the invariants hold under concurrency.
  - **At least one owner always exists:** demoting, removing or leaving as the last owner is
    `409 WORKSPACE_LAST_OWNER_REQUIRED`. An owner can make others owners.
  - **There is no invitation to a workspace.** An owner adds someone (`POST /workspaces/:workspaceId/members`
    with `email`, `name`, `role`) and they are a member at once. An email that is not a user yet
    becomes a user of that tenant (`name` is used only then) and logs in with a one-time code; an
    email of another tenant's user is `409 USER_EMAIL_TAKEN`. No email is sent when adding.
  - Only owners add members, change roles (`PATCH /workspaces/:workspaceId/members/:userId`) and remove members
    (`DELETE ...`); `403 WORKSPACE_OWNER_REQUIRED` otherwise. **Removing a member, or leaving,
    deletes the user** (same transaction): a tenant has one workspace, and login and refresh both
    need the user row, so access ends at once (an access token stays valid up to 15 minutes, and
    `GET /workspaces/:workspaceId` answers 404 to a non-member). Any member can leave
    (`POST /workspaces/:workspaceId/leave`). `GET /workspaces/:workspaceId` returns the caller's
    role, `memberCount` and a preview of the 10 newest members (`created_at DESC, user_id DESC`);
    `GET /workspaces/:workspaceId/members?page=&limit=` lists all of them with offset pagination
    (`page` default 1, `limit` default 20, max 100; `{ items, page, limit, total }`), both members
    only (404 otherwise). All routes need a `user` principal; admins get 403.
  - Migration 0010 backfills a workspace per existing tenant that has users and makes every
    existing user an owner (those users were all created as tenant owners); a tenant without users
    gets none. Migration 0009 stops with a readable error if an email is shared by two tenants.
    Both were edited after being written (before any deployment) to be safe on existing data, and
    `test/integration/migrations.int-spec.ts` runs them on pre-filled databases.
- **Admins are a separate module and table** so `users.tenant_id` never needs to be nullable.
- **The seed admin has a fixed id (`SEED_ADMIN_ID`).** `pnpm db:seed` is idempotent and reads
  `ADMIN_SEED_EMAIL`; changing the env value and re-running updates that admin's email instead of
  creating a second one. An email that belongs to a different admin makes the seed fail.

## Invitations and OTP

- **Flow:** `InviteTenant` (admin) creates a pending invitation and emails a 6 digit OTP;
  `AcceptInvitation` (invitee, with invitation id + OTP + tenant name + own name) creates the tenant
  and its owner and marks the invitation accepted. Use-cases are `@nestjs/cqrs` commands with handlers.
- **One pending invitation per email**, enforced by a partial unique index
  (`uq_invitations_email_pending`). Inviting the same email again is a resend: same invitation, new
  OTP, fresh expiry, attempts reset.
- **Validity: 7 days.** Long because a prospective tenant may not open the email right away. This is
  safe because the OTP locks after 5 wrong attempts (`MAX_OTP_ATTEMPTS`), so guessing odds stay
  about 5 in 1,000,000 per invitation however long it lives. Constant: `INVITATION_TTL_MS`.
- **OTP storage:** only an HMAC-SHA256 is stored, keyed by `OTP_SECRET` (required, at least 32
  characters) and bound to the invitation id. A plain hash of six digits is trivially reversible, so
  the secret and the attempt limit are what protect it. Comparison is constant-time. Changing the
  secret invalidates pending invitations only.
- **Wrong OTP does not throw inside the aggregate:** `accept` returns `false` and records the attempt.
  `AcceptInvitation` runs in one unit of work with the invitation row locked (`FOR UPDATE`) and
  returns "wrong OTP" as a value, so the attempt is committed and only then `InvalidOtpError` is
  thrown. Throwing inside the transaction would roll the attempt back and defeat the lockout.
- **Concurrent accepts are safe:** the row lock makes the second request wait, then see the
  invitation as accepted (`INVITATION_NOT_PENDING`), so only one tenant is created (covered by an
  integration test).
- **Ports used by invitations:** `OtpService`, `Mailer`, `Clock` (shared, `@common/clock`) and
  `UnitOfWork` (shared, `@common/database`, bound to `DatabaseContext`). The invitation mail goes
  through the shared mail transport (see "Email").
- **Cross-module calls:** `AcceptInvitation` calls the tenants and users repository ports directly
  (no events), as decided for module collaboration.
- **No admin existence check in `InviteTenant`:** the foreign key rejects an unknown admin. An admin
  deleted while their access token is still valid gets an unmapped foreign-key error (500), until
  admins can be deleted at all.
- **Saving an invitation updates only a pending row** (`setWhere`), so a resend that races with an
  accept fails with `409 INVITATION_NOT_PENDING` instead of reviving the accepted invitation. Login
  challenges and workspaces use the same guard (`setWhere` plus `returning`; a skipped update
  raises `LoginChallengeAlreadyPendingError`, which the login code flow treats as "someone else
  handled it", or `409 WORKSPACE_ID_CONFLICT` when the workspace belongs to another tenant).

## HTTP API

- **Global prefix `/v1`**, set in `configureApp` (`src/configure-app.ts`), used by `main.ts` and by
  tests that boot the app. It leaves room for a future version without breaking old clients.
- **Input validation: zod schemas plus a small `ZodValidationPipe`** (`src/common/validation`), not
  `nestjs-zod`. No new dependency, the error shape is ours, and request types come from
  `z.infer`. Switching to `nestjs-zod` later only changes the pipe and DTO declarations.
  Schemas check types and shape only; business rules (name length, email format) stay in the domain
  so they are not duplicated.
- **Validation errors:** `422` with `{ "error": { "code": "INPUT_INVALID", "fields": [{ "path",
  "code" }] } }`. `code` is the zod issue code, never prose, so clients can translate per field.
  `DomainError` carries optional `details`, which the filter spreads into the `error` object.
- **Request id and one error envelope:** the server generates the request id (UUID v7 via Fastify
  `genReqId`; an incoming `x-request-id` is never trusted). It is sent as the `x-request-id`
  response header on every response and as a top-level `requestId` beside `error` in every error
  body: `{ "error": { "code", ...details }, "requestId" }`. One catch-all `ErrorFilter` handles
  `DomainError` (status from the registry), HTTP/Fastify 4xx errors (status kept, code from a
  status map, message never echoed; unknown 404 is `NOT_FOUND`) and everything else (500
  `INTERNAL_ERROR`, logged with its stack; the request id is added to the log line as `reqId`).
- **Logging:** pino through `nestjs-pino`, JSON lines on stdout (Cloud Run / Cloud Logging
  friendly): the level is written as `severity` (`WARNING`, `CRITICAL`, ...), the text as
  `message`. `LOG_LEVEL` (pino levels, default `info`, `silent` in tests) sets the threshold.
  `req.headers.authorization`, `req.headers.cookie` and the `set-cookie` headers are redacted;
  bodies are never logged. One access-log line per request (5xx `error`, 4xx `warn`, else `info`),
  health probes excluded. There is one request id: `generateRequestId` creates it once in
  Fastify's `genReqId` and stores it on the raw request, where pino-http reuses it, so the header,
  the error body `requestId` and every log line's `reqId` (including Nest `Logger` calls during
  the request) are identical. `main.ts` uses it for the app; the outbox worker, seed and migrate
  scripts stay on Nest's default logger. Only `NODE_ENV=development` switches to human-readable
  output via `pino-pretty` (single line, colorized, no severity field); production and test stay
  JSON. `pino-pretty` is a devDependency, so images that prune dev deps must not run with
  `NODE_ENV=development`.
- **Ids in the URL are validated in the handler** with `toInvitationId`, so a malformed id answers
  `422 ID_INVALID` instead of reaching the database.
- **Controllers stay thin:** parse and validate, dispatch a command on the `CommandBus` (injected
  with `@Inject(CommandBus)`), return the result. They hold no business logic.
- **Invitations expose two routes:** `POST /v1/invitations` (invite a tenant, admin only) and
  `POST /v1/invitations/:id/accept`. The accept endpoint is public by design; the per-invitation
  attempt lock and the per-IP rate limit protect it from brute force.

## API documentation

- **Scalar UI served from an OpenAPI 3.1 document built from the zod schemas**, with no
  `@nestjs/swagger` and no decorators on controllers. `buildOpenApiDocument` (`src/common/openapi`)
  turns each module's route docs (`presentation/<x>.openapi.ts`: method, path, tag, params, body,
  response, error codes) into the document using `z.toJSONSchema`. The same zod schemas validate
  requests and describe them, so they cannot drift apart.
- **Error responses are generated from the exhaustive status map:** a route lists the error codes it
  can return and the builder groups them by their mapped status. A code without a status makes
  startup/tests fail. **An error response has no body schema**; its description is the list of
  error codes for that status. The error envelope is described in this file, not in the OpenAPI
  document.
- **Scalar theme: `kepler` as the base, recolored with Catppuccin** (`src/common/docs-theme`):
  Latte for light mode and Mocha for dark mode, with the official palette values.
  - **All 26 colors of each flavor are the `LatteColor` and `MochaColor` objects**
    (`catppuccin.ts`); change a hex there and the whole page follows.
  - **Styled like the Catppuccin userstyles and VS Code extension:** the CSS declares every color as a
    `--ctp-<name>` variable, one `--ctp-accent` variable that points at the chosen accent, and
    Scalar's own tokens (`--scalar-color-1`, `--scalar-background-1`, ...) only reference those
    variables. Nothing else holds a hex value.
  - **Roles** (`scalar-roles.ts`) say which palette color each Scalar token uses, one map per mode.
    They were picked as the Catppuccin color closest to what kepler uses today: text, subtext1/0
    and overlay for the three text levels, crust, mantle and base for the three backgrounds in dark
    mode (base, mantle and crust in light mode), surface0 for borders, and the status colors by
    meaning (green, red, yellow, peach as orange, mauve as purple, sapphire as blue, teal for
    query). The accent defaults to lavender, the closest to kepler's blue-violet.
  - **Switching the accent:** any of the 14 Catppuccin accents (rosewater, flamingo, pink, mauve,
    red, maroon, peach, yellow, green, teal, sky, sapphire, blue, lavender). Set `DOCS_ACCENT` for
    the default, or add `?accent=mauve` to the `/docs` URL to try one without a restart. Unknown
    values fall back to the default, so the query cannot inject CSS.
  - **Color mode:** `toggle` (default, Scalar's own behavior with the dark/light toggle visible) or
    `system` (follows the OS theme, no toggle). Set `DOCS_COLOR_MODE` for the default, or add
    `?mode=system` to the `/docs` URL; unknown values fall back to the default. Scalar prefers a
    choice stored by its toggle (`localStorage.colorMode`) over the OS theme, so in `system` mode the
    toggle is hidden (`hideDarkModeToggle`) and a tiny inline script injected before `</body>`
    removes the stored choice; Scalar then follows the OS theme and updates live when it changes.
  - Kepler's original colors were read from `@scalar/themes` 0.20.0, and the palette values were
    checked against `catppuccin/palette`. The "Ask AI" agent
  (`agent.disabled`) and the developer tools console (`showDeveloperTools: "never"`) are turned off, and so are the "Test Request" button
  (`hideTestRequestButton`) and the "Open API Client" button (`hideClientButton`).
  The "Show Schema" toggle of the response card has no option, so a CSS rule hides it
  (`HIDE_SHOW_SCHEMA_CSS` in `src/api-docs.ts`). The expand glyph of the response rows is kept.
  Scalar forces `.dark-mode` on the request example card, so in light mode the theme CSS also
  overrides it in an earlier `@layer` with `!important` (for important declarations the earliest
  layer wins, and Scalar's own rules are `!important`), so that card follows Latte.
- **Served at `/docs` (UI) and `/docs/openapi.json`**, outside the `/v1` prefix, and only when
  `NODE_ENV` is not `production` (`configureApp({ docs })`).
- **The OpenAPI document is downloadable** at `/docs/openapi.json` (served with
  `Content-Disposition: attachment; filename="openapi.json"`), so it can be saved or imported by URL
  into Postman, Insomnia or Apidog. Like the docs page it exists only outside production.
- **Drift guard:** an e2e test compares the routes registered in Nest with the documented ones. A
  new controller route without a route doc fails the test (only `GET /`, the scaffold hello route,
  is exempt).
- **Adding an endpoint means:** the controller, a route doc next to it, and its entry in
  `src/openapi.ts`.
- The Scalar page loads its script from a CDN by default, so the page needs internet access.

## Authentication

- **Passwordless OTP login for admins and tenant users.** `POST /v1/auth/admin/otp` and
  `POST /v1/auth/user/otp` email a 6 digit code, `POST /v1/auth/admin/token` and
  `POST /v1/auth/user/token` exchange it for tokens, `POST /v1/auth/refresh` rotates, and
  `POST /v1/auth/logout` revokes.
- **Tenant users log in with just `{ email }`** (+ `otp` on the token step): an email belongs to at
  most one user, so it identifies the tenant too. Passwordless OTP was chosen to reuse the whole
  challenge/token machinery and avoid password storage, resets and breach handling.
  - `Principal` is `{ type: 'admin' | 'user', id, tenantId? }`. A user principal always carries
    `tenantId` (JWT claim `tenant_id`, stored in `refresh_tokens.tenant_id`); an access token of type
    `user` without it is rejected. Admin-only routes still use `@RequirePrincipal(admin)`.
  - A challenge is scoped by `login_challenges.tenant_id` (null for admins). Pending uniqueness is
    per scope: `uq_login_challenges_email_pending` (admins) and
    `uq_login_challenges_tenant_id_email_pending` (users), so a code requested for a tenant cannot
    be used on another tenant or on the admin login.
  - `LoginCodes` (`application/login-codes.service.ts`) holds the shared send/verify logic; the four
    login handlers are thin. The per-email rate limit is shared with admin logins (same email key).
  - Refreshing a user session checks that the user still exists (else the family is revoked), as
    for admins.
  - An unknown user is indistinguishable from a wrong code (`202` on request, `401
    AUTH_CREDENTIALS_INVALID` on verify).
- **Tokens: short JWT access token plus a rotating refresh token kept in the database.**
  - Access token: JWT (HS256, `jose`, signed with `JWT_SECRET`, at least 32 characters, separate
    from `OTP_SECRET`), valid 15 minutes, claims `sub`, `principal_type`, `iss`, `jti`. It is
    verified without a database query. Lifetimes live in `application/token-lifetimes.ts`.
  - Refresh token: 32 random bytes (base64url), valid 30 days. Only its SHA-256 is stored (the
    token has full entropy, so a plain hash is enough). Each use marks it used and issues a new
    one in the same family.
  - Reuse detection: presenting an already used or revoked refresh token revokes the whole family
    (the session), because it means the token leaked. `logout` revokes the family too.
  - The revocation is committed before the error is thrown, as with the invitation attempts.
  - `refresh_tokens.principal_id` has no foreign key because a principal is an admin or a tenant
    user; `tenant_id` has a foreign key (`ON DELETE RESTRICT`).
- **Login challenges** (`login_challenges`) work like invitations: HMAC-hashed OTP bound to the
  challenge id, 15 minute validity, 5 wrong attempts lock it, one pending challenge per email
  (partial unique index). Requesting a code again regenerates it, which resets its attempts, so
  wrong codes are also capped across codes: 10 per hour per email and IP
  (`LOGIN_VERIFY_FAILURES_PER_EMAIL_IP`) and 30 per day per email
  (`LOGIN_VERIFY_FAILURES_PER_EMAIL`). Only failures count: the budget is checked first
  (`assertBelow`, which counts nothing) and a failure is recorded after verification, for unknown
  emails too so they behave the same. Per IP, so a stranger burns their own budget and cannot lock
  the real user out from another address; the per-email ceiling bounds a distributed guesser
  (about 30 guesses a day, ~1% a year per account) at the price listed in the known gaps. Admin and
  user logins share the same keys (same email).
- **No account enumeration:** requesting a code always answers 202, and every verify failure
  (unknown email, wrong code, expired, locked, already used) gives the same `401
  AUTH_CREDENTIALS_INVALID`. Known leaks left: timing (an unknown email skips the mail send) and
  response differences under heavy load; rate limiting (below) is what makes them hard to exploit.
- **Default-deny authorization:** a global `AuthGuard` requires a valid `Authorization: Bearer`
  token on every route. `@Public()` opts a route or controller out, `@RequirePrincipal(type)`
  restricts it to a principal type (403 otherwise), and `@CurrentPrincipal()` injects the caller.
  The guard is registered in `AppModule` (`APP_GUARD`), after `RateLimitGuard`.
- **Currently public routes:** the six `/v1/auth/*` routes, `POST /v1/invitations/:id/accept`, the
  two `/v1/health/*` routes and the scaffold `GET /v1`. `POST /v1/invitations` (invite a tenant)
  needs an admin.
- **Shared OTP service:** `OtpService` and its HMAC implementation moved to `src/common/otp`
  (hash bound to a `subjectId`) and are used by invitations and auth.
- **The login code mail never reveals whether the email is an admin:** if Resend fails
  (`MAIL_DELIVERY_FAILED`) the error is logged and the request still answers 202. The invitation
  mail does surface the failure (502), because only an authenticated admin can trigger it and
  inviting again is a safe retry.

## Email

- **Transport: Resend**, behind a small `MailTransport` port (`src/common/mail`). Each module owns
  its message (`EmailMailer` for invitations, `EmailLoginMailer` for login codes) and passes plain
  `{ to, subject, text, html }` to the transport, so the provider can change without touching the
  modules. Messages are in English.
- **Configuration:** `RESEND_API_KEY` and `MAIL_FROM` (a sender on a domain verified in Resend, such
  as `Name <no-reply@domain>`). Both are required in production and as soon as a key is set.
- **Without a key (development and tests)** the `LogMailTransport` writes the message to the log
  instead, so the OTP is readable locally. That fallback is impossible in production because the
  environment validation fails first.
- **A failed delivery is a `MailDeliveryError` (502).** See "Authentication" for how the login code
  flow hides it.

## Rate limiting

- **`@nestjs/throttler` with a Postgres storage** (`rate_limits`, `src/common/rate-limit`). Postgres
  rather than memory because Cloud Run runs many short-lived instances; per-process counters would
  multiply the limits and reset on every cold start. Redis would be faster but adds infrastructure.
- **Fixed window per key**, updated with one atomic upsert and timed by the database clock, so all
  instances agree. Expired rows are removed opportunistically (every 200 hits per process).
- **Order of the global guards matters:** `RateLimitGuard` runs before `AuthGuard`, so unauthenticated
  floods are limited before any token work (both registered in `AppModule`, in that order).
- **Limits** (constants next to the code that uses them):
  - default: 120 requests per minute per IP, on every route;
  - `POST /v1/auth/{admin,user}/otp`: 10 per 15 minutes per IP and 5 per hour per email;
  - `POST /v1/auth/{admin,user}/token`: 10 per 15 minutes per IP, 10 wrong codes per hour per
    email and IP and 30 per day per email (plus the 5 attempt lock per challenge);
  - `POST /v1/auth/refresh`: 30 per minute per IP;
  - `POST /v1/invitations/:id/accept`: 10 per 15 minutes per IP (plus the lock per invitation);
  - `/v1/health/*` is not limited.
- **The per-email limits live in the use-case** (`RateLimiter` port, key is the SHA-256 of the rule
  name and the normalized email, plus the IP where a rule is per IP) and apply before the admin
  lookup, so a stranger and an admin get identical answers, and no raw email is stored. The port
  has `consume` (counts a hit) and `assertBelow` (reads the current window without counting, via
  `PostgresThrottlerStorage.peek`).
- **Answer:** `429` with `{ "error": { "code": "RATE_LIMIT_EXCEEDED", "retryAfterSeconds": n } }` and
  a `Retry-After` header. The filter turns any error detail called `retryAfterSeconds` into that
  header.
- **Client IP:** `TRUST_PROXY_HOPS` (default 0) is the number of proxies in front of the app whose
  `X-Forwarded-For` entries are trusted, counted from the socket. With 0 the header is ignored, so
  it cannot be spoofed. Behind a load balancer set the real hop count, otherwise every client
  shares the proxy's IP. Verify it against real logs after deploying.
- **Fails open** when the storage is unavailable (see the gaps below).

## Health, security headers and runtime

- **`GET /v1/health/live`** (process is up) and **`GET /v1/health/ready`** (database answers a
  `select 1`, else `503 HEALTH_NOT_READY`). Public, not rate limited, documented in the OpenAPI.
- **`@fastify/helmet`** sets the standard security headers. Its CSP is turned off only while the
  Scalar docs are enabled (non-production), because the docs page needs inline scripts.
- **`DATABASE_POOL_MAX`** (default 5) caps connections per instance. With autoscaling the total is
  `instances x pool`, which must stay well below the database's `max_connections`.
- **Migrations and seeding run as one-off jobs, not at startup:** `node dist/migrate.js` (uses
  `drizzle-orm`'s migrator, so it works in the production image without `drizzle-kit`) and
  `node dist/seed.js`. `pnpm db:migrate` (drizzle-kit) stays for development.

## Docker image

- **Multi-stage build on `node:22-alpine`** (`Dockerfile`): `deps` (all dependencies, cached store)
  -> `build` (`nest build`) -> `prod-deps` (production dependencies only) -> `runtime`. The runtime
  stage holds `node_modules` (production only), `dist`, `drizzle` and `package.json`, runs as the
  non-root `node` user, sets `NODE_ENV=production` and `PORT=8080`.
- The build stage copies `.swcrc`, so the image compiles with the same SWC options as a local build.
- Installs use `--ignore-scripts` (the only build scripts are esbuild's and the embedded Postgres
  helper's, which the image does not need).
- `.dockerignore` keeps every `.env*` file (except `.env.example`), tests and docs out of the
  build context. **The image has not been built or run yet.**

## Deployment on Cloud Run

Starting points, to be tuned with Cloud Run metrics (CPU, memory, latency, instance count):

- **CPU 1, memory 512 MiB**, and `NODE_OPTIONS=--max-old-space-size=384` so V8 stays below the
  container limit. Raise memory to 1 GiB only if instances are OOM-killed.
- **Concurrency 50** (the default is 80). Requests mostly wait on the database; 50 keeps queueing on
  the 5-connection pool short. Lower it if p95 latency grows under load.
- **Min instances 0** for development and staging, **1** for production to avoid cold starts on the
  login endpoints. **Max instances** such that `max x DATABASE_POOL_MAX` is at most about 70% of the
  database's `max_connections` (for example 10 x 5 = 50).
- **CPU allocation: always** (`--no-cpu-throttling`, instance-based billing) because the outbox relay
  polls inside the web process (see "Domain events and outbox"); this needs min instances of at
  least 1, which the deploy step enforces. Enable startup CPU boost. Request timeout 30-60 s.
- **Probes:** startup probe on `/v1/health/ready`, liveness probe on `/v1/health/live`.
- **Network:** ingress "internal and cloud load balancing" behind a global external Application Load
  Balancer with Cloud Armor, and unauthenticated invocations allowed (the app does its own
  authentication). Set `TRUST_PROXY_HOPS` to the real number of hops.
- **Secrets from Secret Manager** as environment variables (`DATABASE_URL`, `OTP_SECRET`,
  `JWT_SECRET`, `RESEND_API_KEY`); plain variables for `MAIL_FROM`, `TRUST_PROXY_HOPS`,
  `DATABASE_POOL_MAX`. A dedicated service account with only the Cloud SQL Client and Secret
  Accessor roles.
- **Database:** same region as Cloud SQL, through the Cloud SQL connector or private IP (Direct VPC
  egress). `DATABASE_URL` is validated with `z.url()`, which may reject the Unix-socket form
  (`@/db?host=/cloudsql/...`); use private IP or relax the validation after testing.
- **Provisioning is a gcloud script, not Terraform** (`deploy/cloud-run.sh`, steps `setup`,
  `secrets`, `jobs`, `deploy`, `edge`, `armor`; `jobs` runs the migrations before the new code is
  deployed, because `/health/ready` only checks that the database answers): one fewer tool to learn
  and state to keep. Armor
  rules start in preview (log only); set `ARMOR_PREVIEW=` to enforce. **Not run yet**;
  `TRUST_PROXY_HOPS=2` and the probe flags need checking on the first deploy.
- **Cloud Armor** (edge): per-IP rate based rules on `/v1/auth/*` and `/v1/invitations/*/accept`,
  plus the preconfigured OWASP rules. Its limits complement the application's, which also cover
  per-email limits that Cloud Armor cannot see.

## Errors

- **Every domain error extends `DomainError(code, message)`.** `code` is the stable contract with
  clients (they translate it); `message` is English and only for logs and developers. The response
  body is `{ "error": { "code": "..." } }`, with no message, so internals do not leak.
- **Class names are adjective-first** (`InvalidEmailError`, `InvalidOtpError`).
- **Codes are subject-first:** `<MODULE>_<SUBJECT>_<STATE>`, or `<SUBJECT>_<STATE>` for shared ones
  (`USER_EMAIL_TAKEN`, `TENANT_NAME_TOO_LONG`, `EMAIL_INVALID`). Codes of one entity sort together.
  The key in the `XErrorCodes` object equals the value without the module prefix.
- **Status maps are exhaustive.** Each module has `presentation/<x>-error-status.ts` declared
  `as const satisfies Record<XErrorCode, number>`, and `src/error-status.ts` merges them with the union
  of all code types. A new code without a status does not compile.
- **Unmapped codes** produce `500 INTERNAL_ERROR` and one log line (`Unmapped error code X`). Only
  `DomainError` is caught by the filter; other exceptions use Nest defaults.
- **Status choices:** validation of shape or value 422; state conflicts and uniqueness 409; not found
  404; expired invitation 410; too many OTP attempts 429; wrong OTP 422; corrupted stored status 500.

## Persistence

- **Repositories map rows to aggregates** with a `toX(row)` function using `restore`. Enum-like
  columns are plain `varchar` (no `pgEnum`) validated in the mapper, so adding a value never needs an
  `ALTER TYPE`; an unknown stored value fails loudly (`INVITATION_STATUS_INVALID`).
- **`save` is an upsert** (`onConflictDoUpdate` on the id). For tenant-owned rows the update has
  `setWhere` on the tenant, so a reused id cannot overwrite another tenant's row (it raises
  `USER_ID_CONFLICT`).
- **Unique violations become domain errors** through `isUniqueViolation`, which walks `error.cause`
  because Drizzle may wrap the `pg` error.
- **Transactions are ambient** via `DatabaseContext` (`AsyncLocalStorage`, `src/common/database`).
  Repositories read `context.client` at call time, so inside `context.run(work)` they join the
  transaction without extra parameters; a nested `run` joins the outer one; any throw rolls back.
  `nestjs-cls` with `@nestjs-cls/transactional` was considered and rejected for now: our needs fit in
  about 25 lines. Revisit if we need request-scoped context, propagation modes or after-commit hooks.
- **Database object names use a kind prefix and are always set explicitly:**
  - primary key `pk_<table>` (`pk_users`), foreign key `fk_<table>_<column>` (`fk_users_tenant_id`),
    unique `uq_<table>_<columns>` (`uq_workspaces_tenant_id`), index `idx_<table>_<columns>`
    (`idx_users_tenant_id`), check `ck_<table>_<rule>`.
  - Named by columns, in column order, never by business purpose. A partial index gets a suffix for
    its condition (`uq_invitations_email_pending`). Keep names within Postgres' 63 characters.
  - Every foreign key states `ON DELETE` (we use `RESTRICT`, except
    `workspace_members.workspace_id`, which cascades with its workspace) and its first column gets an `idx_`
    index, because Postgres does not index foreign key columns and deleting a parent row checks the
    child table.
  - Why prefixes: the kind is visible in error messages and logs, and it is the style we already
    used for unique indexes. Drizzle's default foreign key names (`<table>_<col>_<ref>_<col>_fk`) are
    not used.
  - Enforced by `test/integration/schema-naming.int-spec.ts`, which reads the real catalog after the
    migrations run.
  - Renaming existing objects goes in a migration as `RENAME CONSTRAINT` / `ALTER INDEX ... RENAME`,
    not drop and recreate: `drizzle-kit` cannot generate a primary key rename and its output must be
    edited by hand (see `0005_use_prefixed_constraint_names.sql`).
- **Migrations:** `pnpm db:generate` creates SQL under `drizzle/`, review it, commit it, apply with
  `pnpm db:migrate`. Never edit an applied migration. (0009 and 0010 were edited after the
  development database had applied them, before any deployment. The migrator only compares
  timestamps, so that database keeps the old SQL: reset it, or remove workspaces without members.)
  Gotcha: values inside `sql` in an index
  predicate become bind parameters, which DDL rejects; use `sql.raw` for literals.
- **Column lengths match value object limits** (email 320, names 255).

## Domain events and outbox

- **Every mutation of an aggregate raises a domain event**, even when the only reaction is a log
  line. Aggregates extend `AggregateRoot` (`src/common/ddd`): `create` and every behaviour method
  call `addEvent`, `restore` never does. Events are named `<Aggregate><PastTense>Event`, carry only
  primitives and never secrets (no OTP or token hashes), and live in
  `modules/<m>/domain/events/<aggregate>.events.ts` with their names in an `as const` object.
  A call that changes nothing (wrong state, expired, reused token) raises nothing.
- **Events are published after commit, through a transactional outbox.** `save` of every Drizzle
  repository runs inside `saveAggregate` (`src/common/outbox`), which writes the aggregate and its
  pulled events in one transaction (it joins the use case's unit of work, or opens its own).
  `OutboxRelay` polls the `outbox` table (`FOR UPDATE SKIP LOCKED`, safe with several instances) and
  calls the consumers; a crash between commit and publish loses nothing.
- **Delivery is at-least-once.** A consumer must tolerate the same event id twice (check state,
  upsert, or keep a processed-events table). A failing consumer never reaches the request: the relay
  records `attempts` and `last_error` and retries; after `MAX_OUTBOX_ATTEMPTS` the row stays
  unprocessed as a dead letter to inspect.
- **What must be atomic is not an event reaction.** Anything that has to succeed or fail together
  with the original write is done in the use case inside `unitOfWork.run`. Reactions run after the
  request's transaction has committed and must not depend on it, and no external call (mail, HTTP)
  happens inside a business transaction.
- **Today the only consumer is `LoggingOutboxConsumer`.** To add one, implement `OutboxConsumer` and
  add it to the `OUTBOX_CONSUMERS` factory in `OutboxModule`.
- **Where the relay runs depends on the platform, never in a web instance that can be frozen or
  scaled to zero.** `OUTBOX_RELAY_ENABLED` (default `true`) decides whether an instance polls:
  - Polling inside the web process only fits a process that always has CPU: local development, a
    Fargate service, or a Cloud Run service with CPU always allocated and min instances of at least 1.
  - **Cloud Run:** deploy the web service with CPU always allocated (`--no-cpu-throttling`) and min
    instances of at least 1; the relay polls in the web process and events reach consumers about
    `OUTBOX_POLL_INTERVAL_MS` after commit, with no Scheduler or Job. Do not use the default
    request-based CPU: the timer freezes between requests, a frozen instance keeps its transaction and
    row locks open until it wakes or is killed, and with zero instances nothing is published. Every
    instance polls; that is safe (`SKIP LOCKED`) and costs one light query per second each. Cost: one
    vCPU always on is about $45 a month after the free tier (240,000 vCPU-seconds and 450,000
    GiB-seconds a month per billing account, shared with other services and jobs). The cheaper
    fallback is request-based CPU, `OUTBOX_RELAY_ENABLED=false` and a Cloud Scheduler schedule that
    runs a Cloud Run Job with `node dist/outbox-worker.js --once`, at the cost of up to about a minute
    of delay.
  - **AWS Fargate:** web service with `OUTBOX_RELAY_ENABLED=false` plus a separate service running
    `node dist/outbox-worker.js` (desired count 1; more is safe because of `SKIP LOCKED`), or an ECS
    scheduled task running it with `--once`. Raise the task `stopTimeout` to at least 30 s.
  - `dist/outbox-worker.js` polls until SIGTERM; `--once` drains and exits. A one-shot tries each
    failing event once per run, so the schedule is the retry pace.
- **Shutdown is safe but bounded.** SIGTERM stops polling, lets the batch in flight finish, then closes
  the pool. Cloud Run gives 10 s and Fargate 30 s by default; a batch cut short rolls back and is
  delivered again, which at-least-once delivery already allows. Keep consumers fast.
- **Connections:** the relay holds one pooled connection per batch. Count it in the
  `max instances x DATABASE_POOL_MAX` budget (a worker or job has its own pool).
- **Idle cost:** a polling worker runs one query per `OUTBOX_POLL_INTERVAL_MS` even when idle, which
  keeps an auto-pausing database (Aurora Serverless, Cloud SQL with scheduled stops) awake. A
  scheduled one-shot still wakes it once per run; lengthen the schedule there.
- **Not run yet:** the always-on Cloud Run settings and `outbox-worker.js` were not run against real
  Cloud Run or Fargate.
- **Known limits (`shortcut:` in the relay):** row locks are held while consumers run and there is no
  retry backoff; ordering is by event id and only best-effort across relays; processed rows are never
  deleted (add a retention job); `occurredAt` uses the wall clock in methods that receive no `now`.

## Ports and DI

- **Ports are interfaces plus a `Symbol` token** injected with `@Inject(TOKEN)`. Pure types in the
  application layer and no reliance on decorator metadata, which Vitest does not emit by default.
  Switching to abstract classes later is cheap.
- **Modules bind ports with factory providers** (`useFactory` building the Drizzle implementation
  from `DATABASE_CONTEXT`) and export only the token.
- **The database pool is closed on shutdown** (`DatabaseModule`), and `main.ts` enables shutdown hooks.

## Testing

- **Unit tests** (`*.spec.ts`): domain and application logic with in-memory fakes.
- **Integration tests** (`*.int-spec.ts`, `pnpm test:int`): repositories and modules against embedded
  Postgres. A global setup starts it on a free port, runs the migrations, and provides `databaseUrl`.
  Files run serially and tables are truncated (`CASCADE`) before each test.
- **E2E** (`*.e2e-spec.ts`, `pnpm test:e2e`): boots `AppModule`. It sets a dummy `DATABASE_URL`
  because the pool connects lazily.
- **Every repository gets the same cases:** round trip, not found, tenant isolation where relevant,
  uniqueness, and transaction rollback where relevant.

## Code style

- **Comments only for a "why" the code cannot show**, in one or two lines. Use `// TODO` / `// FIXME`
  only for work that is still to be done; a second tag for "may be reconsidered" is still to be
  chosen.
- **No `any`, no `console.*`, error codes and keys as constants** (no magic strings).
- **Comments, code and commit messages in English.**

## Known gaps and pending decisions

- `User.create`, `Tenant.create`, `Admin.create` and `Workspace.create` call `new Date()` themselves.
- `TenantsModule` has no module-level test yet (deferred).
- Not built yet: what the `admin` workspace role may do beyond being a member (only owners manage
  members), rename the workspace, member lists with search or sorting,
  a welcome email when someone is added to a workspace, purging expired `login_challenges`,
  `refresh_tokens` and `rate_limits` rows, structured logging, CORS (needs the frontend origin),
  and a frontend link in the invitation email (it carries the invitation id and the code only).
- Anyone can burn a user's 5 login code requests per hour (the per-email limit is not per IP), and
  each request replaces the code already sent to them. Fix with an email+IP key and a cooldown.
- A guesser using many IPs can still exhaust the per-email ceiling of 30 wrong codes a day, which
  blocks that email's login (admins included) until the window ends. Existing sessions keep
  working. Accepted for now; the real fix is an extra factor or a cooldown per challenge.
- Adding a workspace member answers `409 USER_EMAIL_TAKEN` for another tenant's email, so an owner
  can learn which emails exist elsewhere (limited only by the default 120 requests a minute). Adding
  also binds a new email to the tenant without that person's consent; they can leave, which deletes
  their user and frees the email.
- The rate limiter fails open: if Postgres cannot be reached, requests are allowed and a warning
  is logged. Account protection still holds through the attempt locks, which live in the database
  too.
- The Dockerfile and the Cloud Run / Cloud Armor settings have not been built or deployed yet.
- The scaffold `AppController` (`GET /v1` returning "Hello World!") is still there and undocumented
  on purpose; remove it or document it.
- The tag name for "may be reconsidered" comments is undecided.
- `pnpm db:migrate` and `pnpm db:seed` have been run against the development database (migrations
  through 0010 applied, seed unchanged). The Docker build must be rechecked after the move to SWC
  (the build stage needs the musl `@swc/core` binary).
