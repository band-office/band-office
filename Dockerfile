FROM node:24-bookworm-slim

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

ENV NODE_ENV=production

VOLUME ["/data"]
EXPOSE 3000

CMD ["sh", "-c", "npm run db:deploy && node --import tsx scripts/seed-if-empty.ts && npm start"]
