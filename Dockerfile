# Independent runtime image (no Manus host). Railway-compatible.
# Build: docker build --build-arg BUILD_COMMIT=<sha> --build-arg BUILD_TIME=<iso> -t faultline .
# Start: PORT is read from the environment (Railway injects it).

FROM node:22-bookworm-slim AS build
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

COPY package.json pnpm-lock.yaml .npmrc ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile

COPY . .

# Railway passes RAILWAY_GIT_COMMIT_SHA as a build-arg when this ARG is declared.
# .git is dockerignored, so git rev-parse is unavailable in the image.
# Dashboard BUILD_COMMIT/BUILD_TIME service vars are often stale (e.g. 21f6f18);
# they override image ENV at runtime, so /api/health reads dist/build-identity.json.
ARG RAILWAY_GIT_COMMIT_SHA=
ARG BUILD_COMMIT=
ARG BUILD_TIME=
ENV NODE_ENV=production

RUN COMMIT="${BUILD_COMMIT}"; \
    if [ -z "${COMMIT}" ] || [ "${COMMIT}" = "dev" ]; then COMMIT="${RAILWAY_GIT_COMMIT_SHA}"; fi; \
    TIME="${BUILD_TIME}"; \
    if [ -z "${TIME}" ]; then TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"; fi; \
    export BUILD_COMMIT="${COMMIT:-dev}"; \
    export BUILD_TIME="${TIME}"; \
    echo "Docker build identity COMMIT=${BUILD_COMMIT} TIME=${BUILD_TIME}"; \
    pnpm run build; \
    BUILD_COMMIT="${BUILD_COMMIT}" BUILD_TIME="${BUILD_TIME}" bash scripts/ci-write-build-identity.sh

FROM node:22-bookworm-slim AS runtime
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

ENV NODE_ENV=production
ENV PORT=3000

# Image ENV is informational. Railway service variables named BUILD_COMMIT
# override these at runtime; resolveBuildIdentity prefers the baked JSON.

COPY package.json pnpm-lock.yaml .npmrc ./
COPY patches ./patches
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["pnpm", "start"]
