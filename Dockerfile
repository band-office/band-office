FROM node:24-bookworm-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d AS build

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=file:/data/bandos.db

COPY package.json package-lock.json prisma.config.ts ./
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npm ci

COPY . .
RUN npm run build
RUN mkdir -p .next/standalone/.next \
    && cp -R .next/static .next/standalone/.next/static \
    && cp -R public .next/standalone/public
RUN npm pkg delete devDependencies.prisma \
    && npm prune --omit=dev --ignore-scripts

FROM node:24-bookworm-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d AS runtime

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 bandoffice \
    && useradd --uid 10001 --gid 10001 --home-dir /nonexistent --shell /usr/sbin/nologin bandoffice \
    && mkdir -p /data \
    && chown 10001:10001 /data

COPY --from=build --chown=10001:10001 /app /app
RUN chmod 0755 scripts/docker-entrypoint.sh

ARG BAND_OFFICE_VERSION=0.1.0
ARG BAND_OFFICE_REVISION=unknown
LABEL org.opencontainers.image.title="Band Office Server" \
      org.opencontainers.image.description="District-operated Band Office server with staff, student, and guardian access." \
      org.opencontainers.image.source="https://github.com/band-office/band-office" \
      org.opencontainers.image.licenses="Apache-2.0" \
      org.opencontainers.image.version="${BAND_OFFICE_VERSION}" \
      org.opencontainers.image.revision="${BAND_OFFICE_REVISION}"

ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=file:/data/bandos.db
ENV NODE_ENV=production

VOLUME ["/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1))"]

USER 10001:10001

ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
CMD ["app"]
