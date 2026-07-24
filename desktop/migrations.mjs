import Database from "better-sqlite3";
import { chmod, copyFile, mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

const DESKTOP_MIGRATION_TABLE = "_bandos_desktop_migrations";

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function migrationNames(migrationsDirectory) {
  const entries = await readdir(migrationsDirectory, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

function tableExists(database, name) {
  return Boolean(database.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));
}

export async function runDesktopMigrations({ databasePath, migrationsDirectory, snapshotsDirectory }) {
  await mkdir(path.dirname(databasePath), { recursive: true });
  await mkdir(snapshotsDirectory, { recursive: true });
  const existed = await stat(databasePath).then((value) => value.size > 0).catch(() => false);
  const database = new Database(databasePath);
  let snapshotPath = null;

  try {
    database.pragma("busy_timeout = 5000");
    database.exec(`CREATE TABLE IF NOT EXISTS "${DESKTOP_MIGRATION_TABLE}" ("name" TEXT PRIMARY KEY, "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    const appliedByDesktop = new Set(database.prepare(`SELECT "name" FROM "${DESKTOP_MIGRATION_TABLE}"`).all().map((row) => row.name));
    const appliedByPrisma = tableExists(database, "_prisma_migrations")
      ? new Set(database.prepare("SELECT migration_name AS name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL").all().map((row) => row.name))
      : new Set();
    const names = await migrationNames(migrationsDirectory);
    const pending = names.filter((name) => !appliedByDesktop.has(name) && !appliedByPrisma.has(name));

    if (pending.length && existed && tableExists(database, "Program")) {
      snapshotPath = path.join(snapshotsDirectory, `pre-migration-${timestamp()}.db`);
      await database.backup(snapshotPath);
      await chmod(snapshotPath, 0o600);
    }

    for (const name of names) {
      if (appliedByDesktop.has(name)) continue;
      if (!appliedByPrisma.has(name)) {
        const sql = await readFile(path.join(migrationsDirectory, name, "migration.sql"), "utf8");
        database.exec(sql);
      }
      database.prepare(`INSERT INTO "${DESKTOP_MIGRATION_TABLE}" ("name") VALUES (?)`).run(name);
    }

    database.pragma("foreign_keys = ON");
    database.pragma("journal_mode = WAL");
    return { applied: pending, snapshotPath };
  } catch (error) {
    database.close();
    await rm(`${databasePath}-wal`, { force: true });
    await rm(`${databasePath}-shm`, { force: true });
    if (snapshotPath) {
      await copyFile(snapshotPath, databasePath);
      await chmod(databasePath, 0o600);
    } else if (!existed) await rm(databasePath, { force: true });
    throw error;
  } finally {
    if (database.open) database.close();
  }
}
