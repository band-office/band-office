import "dotenv/config";
import { defineConfig } from "prisma/config";

const databaseUrl = process.env.DATABASE_URL?.trim() || "file:./data/bandos.db";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node --import tsx prisma/seed.ts",
  },
  datasource: {
    url: databaseUrl,
  },
});
