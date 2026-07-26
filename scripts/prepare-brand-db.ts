import { mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import argon2 from "argon2";
import Database from "better-sqlite3";
import { PersonClassificationType, StaffRole } from "../src/generated/prisma/enums";
import { createPrismaClient } from "../src/lib/db";
import { RIDGELINE_PROGRAM_ID } from "../src/lib/seed-data";
import { seedRidgeline } from "../prisma/seed";

const databasePath = resolve(process.env.BANDOS_BRAND_DATABASE_PATH ?? "data/brand.db");
const migrationsRoot = resolve("prisma/migrations");

if (!databasePath.endsWith("/data/brand.db")) {
  throw new Error("Refusing to prepare a database outside the approved brand-preview path");
}

mkdirSync(dirname(databasePath), { recursive: true });
rmSync(databasePath, { force: true });
rmSync(`${databasePath}-shm`, { force: true });
rmSync(`${databasePath}-wal`, { force: true });

const database = new Database(databasePath);
database.pragma("foreign_keys = ON");
for (const directory of readdirSync(migrationsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()) {
  const migrationPath = resolve(migrationsRoot, directory, "migration.sql");
  database.exec(readFileSync(migrationPath, "utf8"));
}
database.close();

const prisma = createPrismaClient(`file:${databasePath}`);

try {
  await seedRidgeline(prisma);
  const passwordHash = await argon2.hash("BandOffice-Preview-2026!", {
    type: argon2.argon2id,
  });

  await prisma.person.create({
    data: {
      id: "brand-preview-director",
      programId: RIDGELINE_PROGRAM_ID,
      firstName: "Preview",
      lastName: "Director",
      classifications: {
        create: { classification: PersonClassificationType.STAFF },
      },
      staffUsers: {
        create: {
          id: "brand-preview-director-user",
          programId: RIDGELINE_PROGRAM_ID,
          username: "director",
          passwordHash,
          role: StaffRole.DIRECTOR,
        },
      },
    },
  });
} finally {
  await prisma.$disconnect();
}

console.log("Prepared deterministic Ridgeline brand-preview database.");
