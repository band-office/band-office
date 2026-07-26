import path from "node:path";
import { runSqliteMigrations } from "../desktop/migrations.mjs";

const databaseUrl = process.env.DATABASE_URL || "file:./data/bandos.db";
if (!databaseUrl.startsWith("file:")) {
  throw new Error("Band Office v0.1 deployment migrations require a SQLite file URL.");
}

const configuredPath = decodeURIComponent(databaseUrl.slice("file:".length));
const databasePath = path.isAbsolute(configuredPath)
  ? configuredPath
  : path.resolve(configuredPath);
const dataDirectory = path.dirname(databasePath);
const result = await runSqliteMigrations({
  databasePath,
  migrationsDirectory: path.resolve("prisma/migrations"),
  snapshotsDirectory: path.join(dataDirectory, "recovery-snapshots"),
});

if (result.applied.length) {
  console.log(`Applied Band Office migrations: ${result.applied.join(", ")}`);
  if (result.snapshotPath) console.log(`Pre-migration snapshot: ${result.snapshotPath}`);
} else {
  console.log("Band Office database schema is current.");
}
