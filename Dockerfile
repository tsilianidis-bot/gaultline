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

ARG BUILD_COMMIT=dev
ARG BUILD_TIME
ENV BUILD_COMMIT=${BUILD_COMMIT}
ENV BUILD_TIME=${BUILD_TIME}
ENV NODE_ENV=production

RUN pnpm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

ENV NODE_ENV=production
ENV PORT=3000

ARG BUILD_COMMIT=dev
ARG BUILD_TIME
ENV BUILD_COMMIT=${BUILD_COMMIT}
ENV BUILD_TIME=${BUILD_TIME}

COPY package.json pnpm-lock.yaml .npmrc ./
COPY patches ./patches
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["pnpm", "start"]
