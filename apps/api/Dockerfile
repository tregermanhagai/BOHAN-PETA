# Builds and runs apps/api for production (Railway). Build context must be
# the repo root (not apps/api) since this is an npm-workspaces monorepo and
# apps/api depends on packages/shared-types.
#
# Prisma's `engineType = "client"` (see prisma/schema.prisma) means there's
# no native query-engine binary to match to this container's OS/arch — the
# usual Docker+Prisma pain point simply doesn't apply here.

FROM node:20-alpine AS builder
WORKDIR /repo

# Manifests only, first — every workspace's package.json must be present
# for `npm ci` to validate against the root lockfile, even though only
# api + shared-types actually get built below.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/api-tests/package.json apps/api-tests/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN npm ci

COPY packages/shared-types packages/shared-types
COPY apps/api apps/api

RUN npm run build --workspace packages/shared-types
RUN npm run build --workspace apps/api
RUN npm run prisma:generate --workspace apps/api

FROM node:20-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production

COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/package.json ./package.json
COPY --from=builder /repo/packages/shared-types ./packages/shared-types
COPY --from=builder /repo/apps/api/package.json ./apps/api/package.json
COPY --from=builder /repo/apps/api/dist ./apps/api/dist
COPY --from=builder /repo/apps/api/generated ./apps/api/generated
COPY --from=builder /repo/apps/api/prisma ./apps/api/prisma
# npm's hoisting doesn't guarantee every dependency lands in the root
# node_modules — `prisma` specifically ends up nested in apps/api's own
# node_modules (a dedup conflict with some other workspace), confirmed by
# directly inspecting the built image. Copy it explicitly so the CLI
# binary invoked below actually exists at runtime.
COPY --from=builder /repo/apps/api/node_modules ./apps/api/node_modules

EXPOSE 3000
# Applies any pending migrations before serving traffic, every deploy.
CMD ["sh", "-c", "./apps/api/node_modules/.bin/prisma migrate deploy --schema apps/api/prisma/schema.prisma && node apps/api/dist/main.js"]
