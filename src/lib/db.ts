import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

const DEFAULT_DATABASE_URL = "file:./data/bandos.db";

function ensureDatabaseDirectory(databaseUrl: string) {
  if (!databaseUrl.startsWith("file:")) {
    return;
  }

  const filePath = databaseUrl.slice("file:".length);
  mkdirSync(dirname(resolve(filePath)), { recursive: true });
}

export function getDatabaseFilePath(databaseUrl = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL) {
  if (!databaseUrl.startsWith("file:")) throw new Error("BandOS backups currently require a SQLite file database.");
  const filePath = decodeURIComponent(databaseUrl.slice("file:".length));
  return isAbsolute(filePath) ? filePath : resolve(filePath);
}

export function createPrismaClient(databaseUrl = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL) {
  ensureDatabaseDirectory(databaseUrl);
  const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  bandosPrisma?: ReturnType<typeof createPrismaClient>;
};

export function getDb() {
  if (!globalForPrisma.bandosPrisma) {
    globalForPrisma.bandosPrisma = createPrismaClient();
  }

  return globalForPrisma.bandosPrisma;
}
