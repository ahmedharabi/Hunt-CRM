# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Install dependencies. Build tools are only a fallback for when no prebuilt
# better-sqlite3 binary matches the platform.
FROM base AS deps
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
# Electron is only needed for the desktop app.
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV HUNT_STANDALONE=1
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    HUNT_DATA_DIR=/data

COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
# Migrations are read from disk at startup, so they aren't traced into the bundle.
COPY --from=build --chown=node:node /app/db/migrations ./db/migrations

RUN mkdir -p /data && chown node:node /data
VOLUME /data
USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/manifest.webmanifest').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

CMD ["node", "server.js"]
