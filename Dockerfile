# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=22
ARG PNPM_VERSION=12.14.0

FROM node:${NODE_VERSION}-alpine AS base
ARG PNPM_VERSION
ENV npm_config_store_dir=/pnpm/store \
    npm_config_package_import_method=copy
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

FROM deps AS build
COPY tsconfig.json tsconfig.build.json nest-cli.json .swcrc ./
COPY src ./src
RUN pnpm build

FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --ignore-scripts

FROM node:${NODE_VERSION}-alpine AS runtime
ENV NODE_ENV=production \
    PORT=8080
WORKDIR /app
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node drizzle ./drizzle
COPY --chown=node:node package.json ./
USER node
EXPOSE 8080
CMD ["node", "dist/main.js"]
