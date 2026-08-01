import Database from "better-sqlite3";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const outputDirectory = path.resolve(process.argv[2] ?? "dist-desktop");
const workDirectory = await mkdtemp(path.join(tmpdir(), "bandos-packaged-acceptance-"));
const skipRuntimeLaunch = process.env.BANDOS_DESKTOP_SKIP_RUNTIME_LAUNCH === "1";

async function executablePath() {
  if (process.platform === "darwin") {
    const directory = (await readdir(outputDirectory, { withFileTypes: true })).find(
      (entry) => entry.isDirectory() && (entry.name === "mac" || entry.name.startsWith("mac-")),
    );
    if (!directory) throw new Error("No unpacked macOS Band Office application was found.");
    return path.join(outputDirectory, directory.name, "Band Office.app", "Contents", "MacOS", "Band Office");
  }
  if (process.platform === "win32") return path.join(outputDirectory, "win-unpacked", "Band Office.exe");
  throw new Error("Packaged desktop acceptance currently supports macOS and Windows.");
}

async function launch(executable, profileName) {
  const userData = path.join(workDirectory, profileName);
  const screenshot = path.join(workDirectory, `${profileName}.png`);
  await mkdir(userData, { recursive: true });
  await new Promise((resolve, reject) => {
    const child = execFile(executable, [], {
      env: { ...process.env, BANDOS_DESKTOP_USER_DATA: userData, BANDOS_DESKTOP_SMOKE_SCREENSHOT: screenshot },
      timeout: 60_000,
    }, (error, stdout, stderr) => error ? reject(new Error(`${error.message}\n${stdout}\n${stderr}`)) : resolve());
    child.once("error", reject);
  });
  assert.ok((await stat(screenshot)).size > 1000, `${profileName} smoke screenshot is empty`);
  const log = await readFile(path.join(userData, "logs", "desktop.log"), "utf8");
  assert.match(log, /Ready in/);
  return userData;
}

async function createHistoricalDatabase(userData) {
  const databasePath = path.join(userData, "data", "bandos.db");
  await mkdir(path.dirname(databasePath), { recursive: true });
  const database = new Database(databasePath);
  try {
    database.exec(await readFile(path.resolve("prisma/migrations/20260719214000_init/migration.sql"), "utf8"));
    database.exec('CREATE TABLE "_bandos_desktop_migrations" ("name" TEXT PRIMARY KEY, "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)');
    database.prepare('INSERT INTO "_bandos_desktop_migrations" ("name") VALUES (?)').run("20260719214000_init");
    database.prepare('INSERT INTO "Program" ("id", "name") VALUES (?, ?)').run("packaged-upgrade", "Packaged Upgrade Program");
    database.prepare('INSERT INTO "Member" ("id", "programId", "firstName", "lastName", "grade", "section") VALUES (?, ?, ?, ?, ?, ?)').run("packaged-member", "packaged-upgrade", "Preserved", "Student", 8, "tuba");
  } finally {
    database.close();
  }
}

try {
  const executable = await executablePath();
  assert.ok((await stat(executable)).isFile(), "Packaged desktop executable is missing.");

  if (skipRuntimeLaunch) {
    console.log("Skipping packaged runtime launch on this constrained CI runner; bundle, architecture, signature, and privacy metadata checks remain required.");
  } else {
    const expectedMigrationCount = (await readdir(path.resolve("prisma/migrations"), { withFileTypes: true })).filter((entry) => entry.isDirectory()).length;
    const freshUserData = await launch(executable, "fresh-profile");
    const freshDatabase = new Database(path.join(freshUserData, "data", "bandos.db"), { readonly: true });
    assert.equal(freshDatabase.pragma("integrity_check", { simple: true }), "ok");
    assert.equal(freshDatabase.prepare('SELECT COUNT(*) AS count FROM "_bandos_desktop_migrations"').get().count, expectedMigrationCount);
    assert.equal(freshDatabase.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name IN ('FinancialBatch', 'FinancialEntry')").get().count, 2);
    assert.equal(freshDatabase.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name IN ('EmailConnection', 'EmailContactState', 'EmailTemplate', 'Announcement', 'AnnouncementAudienceTarget', 'AnnouncementRecipient', 'AnnouncementAttachment', 'DeliveryAttempt', 'CommunicationJob')").get().count, 9);
    assert.equal(freshDatabase.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name IN ('LibraryItem', 'LibraryComponentNote', 'LibraryLoan', 'PerformanceRecord', 'LibraryResource')").get().count, 5);
    assert.equal(freshDatabase.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name IN ('FormTemplate', 'FormTemplateVersion', 'FormQuestion', 'FormCampaign', 'FormRequest', 'FormResponse', 'FormAnswer', 'FormUpload', 'FormReminder')").get().count, 9);
    assert.equal(freshDatabase.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name IN ('EventSeries', 'Event', 'EventGroup', 'EventParticipant', 'EventRsvp', 'AttendanceRecord', 'EventEquipmentItem', 'EventResource', 'VolunteerOpportunity', 'VolunteerSignup', 'EventReminder', 'CalendarSubscription')").get().count, 12);
    freshDatabase.close();

    const upgradeUserData = path.join(workDirectory, "upgrade-profile");
    await createHistoricalDatabase(upgradeUserData);
    await launch(executable, "upgrade-profile");
    const upgraded = new Database(path.join(upgradeUserData, "data", "bandos.db"), { readonly: true });
    assert.equal(upgraded.prepare('SELECT "name", "graduationGrade" FROM "Program"').get().name, "Packaged Upgrade Program");
    assert.equal(upgraded.prepare('SELECT "graduationGrade" FROM "Program"').get().graduationGrade, 8);
    assert.equal(upgraded.prepare('SELECT COUNT(*) AS count FROM "Person"').get().count, 1);
    assert.equal(upgraded.prepare('SELECT "grade" FROM "StudentProfile" WHERE "personId" = ?').get("packaged-member").grade, 8);
    assert.equal(upgraded.prepare('SELECT "name" FROM "Group"').get().name, "tuba");
    assert.equal(upgraded.prepare('SELECT COUNT(*) AS count FROM "GroupMembership" WHERE "personId" = ?').get("packaged-member").count, 1);
    assert.equal(upgraded.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name IN ('FinancialBatch', 'FinancialEntry')").get().count, 2);
    assert.equal(upgraded.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name IN ('EmailConnection', 'EmailContactState', 'EmailTemplate', 'Announcement', 'AnnouncementAudienceTarget', 'AnnouncementRecipient', 'AnnouncementAttachment', 'DeliveryAttempt', 'CommunicationJob')").get().count, 9);
    assert.equal(upgraded.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name IN ('LibraryItem', 'LibraryComponentNote', 'LibraryLoan', 'PerformanceRecord', 'LibraryResource')").get().count, 5);
    assert.equal(upgraded.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name IN ('FormTemplate', 'FormTemplateVersion', 'FormQuestion', 'FormCampaign', 'FormRequest', 'FormResponse', 'FormAnswer', 'FormUpload', 'FormReminder')").get().count, 9);
    assert.equal(upgraded.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name IN ('EventSeries', 'Event', 'EventGroup', 'EventParticipant', 'EventRsvp', 'AttendanceRecord', 'EventEquipmentItem', 'EventResource', 'VolunteerOpportunity', 'VolunteerSignup', 'EventReminder', 'CalendarSubscription')").get().count, 12);
    assert.equal(upgraded.pragma("foreign_key_check").length, 0);
    upgraded.close();
    assert.ok((await readdir(path.join(upgradeUserData, "recovery-snapshots"))).some((name) => name.startsWith("pre-migration-")));
  }

  if (process.platform === "darwin") {
    const appRoot = path.dirname(path.dirname(executable));
    const infoPlist = path.join(appRoot, "Info.plist");
    const camera = await execFileAsync("/usr/bin/plutil", ["-extract", "NSCameraUsageDescription", "raw", infoPlist]);
    assert.match(camera.stdout, /inventory barcode or QR code/);
    for (const key of ["NSMicrophoneUsageDescription", "NSAudioCaptureUsageDescription", "NSBluetoothAlwaysUsageDescription"]) {
      await assert.rejects(execFileAsync("/usr/bin/plutil", ["-extract", key, "raw", infoPlist]));
    }
  }

  console.log(skipRuntimeLaunch
    ? "Packaged desktop acceptance passed: bundle, executable, and privacy metadata checks. Runtime launch is skipped only for this constrained CI runner."
    : "Packaged desktop acceptance passed: fresh startup, historical upgrade, financial, communication, library, forms, and events schemas, recovery snapshot, SQLite integrity, and privacy metadata.");
} finally {
  await rm(workDirectory, { recursive: true, force: true });
}
