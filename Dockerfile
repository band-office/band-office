FROM node:24-bookworm-slim AS build

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

FROM node:24-bookworm-slim AS runtime

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app /app
RUN chmod 0755 scripts/docker-entrypoint.sh

ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=file:/data/bandos.db
ENV NODE_ENV=production

VOLUME ["/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1))"]

ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
CMD ["app"]
