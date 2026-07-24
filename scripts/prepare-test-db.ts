import { mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";

const databasePath = resolve(process.env.BANDOS_TEST_DATABASE_PATH ?? "data/test.db");
const migrationsRoot = resolve("prisma/migrations");

if (!databasePath.endsWith("/data/test.db") && !databasePath.endsWith("/data/e2e.db")) {
  throw new Error("Refusing to prepare a database outside the approved test database paths");
}

mkdirSync(dirname(databasePath), { recursive: true });
rmSync(databasePath, { force: true });
rmSync(`${databasePath}-shm`, { force: true });
rmSync(`${databasePath}-wal`, { force: true });

const database = new Database(databasePath);
database.pragma("foreign_keys = ON");
for (const directory of readdirSync(migrationsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()) {
  const migrationPath = resolve(migrationsRoot, directory, "migration.sql");
  try {
    database.exec(readFileSync(migrationPath, "utf8"));
  } catch (error) {
    throw new Error(`Failed to apply test migration ${directory}`, { cause: error });
  }
}
database.close();

console.log("Prepared isolated SQLite test database.");
