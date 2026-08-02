import Database from "better-sqlite3";
import JSZip from "jszip";
import Papa from "papaparse";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { validateBackupArchive } from "../desktop/backup-archive.mjs";
import {
  applyPendingDemoReset,
  applyPendingRestore,
  assertRidgelineDemoDatabase,
  PENDING_DEMO_RESET_FILENAME,
  PENDING_EVENT_RESTORE_DIRECTORY,
  PENDING_FORM_RESTORE_DIRECTORY,
  PENDING_LIBRARY_RESTORE_DIRECTORY,
  PENDING_RESTORE_FILENAME,
  RIDGELINE_DEMO_PROGRAM_ID,
} from "../desktop/data-lifecycle.mjs";
import { runDesktopMigrations } from "../desktop/migrations.mjs";
import { runtimeAliasSegments } from "../desktop/runtime-alias.mjs";

const migrationsDirectory = path.resolve("prisma/migrations");
const firstMigration = "20260719214000_init";
const v2ArchiveTables = [
  ["programs", "Program"], ["members", "Member"], ["assets", "Asset"], ["components", "AssetComponent"],
  ["assignments", "Assignment"], ["repairs", "Repair"], ["operating_periods", "OperatingPeriod"],
  ["audit_log", "AuditLog"], ["backup_records", "BackupRecord"],
];
const v3ArchiveTables = [
  ["programs", "Program"], ["people", "Person"], ["student_profiles", "StudentProfile"],
  ["person_classifications", "PersonClassification"], ["groups", "Group"], ["group_memberships", "GroupMembership"],
  ["guardian_students", "GuardianStudent"], ["assets", "Asset"], ["components", "AssetComponent"],
  ["assignments", "Assignment"], ["repairs", "Repair"], ["operating_periods", "OperatingPeriod"],
  ["audit_log", "AuditLog"], ["backup_records", "BackupRecord"],
];
const v4ArchiveTables = [
  ["programs", "Program"], ["people", "Person"], ["student_profiles", "StudentProfile"],
  ["person_classifications", "PersonClassification"], ["groups", "Group"], ["group_memberships", "GroupMembership"],
  ["guardian_students", "GuardianStudent"], ["assets", "Asset"], ["components", "AssetComponent"],
  ["assignments", "Assignment"], ["repairs", "Repair"], ["financial_batches", "FinancialBatch"],
  ["financial_entries", "FinancialEntry"], ["operating_periods", "OperatingPeriod"],
  ["audit_log", "AuditLog"], ["backup_records", "BackupRecord"],
];
const v5ArchiveTables = [
  ...v4ArchiveTables.slice(0, 13),
  ["email_connections", "EmailConnection"], ["email_contact_states", "EmailContactState"],
  ["email_templates", "EmailTemplate"], ["announcements", "Announcement"],
  ["announcement_audience_targets", "AnnouncementAudienceTarget"], ["announcement_recipients", "AnnouncementRecipient"],
  ["announcement_attachments", "AnnouncementAttachment"], ["delivery_attempts", "DeliveryAttempt"],
  ["communication_jobs", "CommunicationJob"],
  ...v4ArchiveTables.slice(13),
];
const v6ArchiveTables = [
  ...v5ArchiveTables.slice(0, 22),
  ["library_items", "LibraryItem"], ["library_component_notes", "LibraryComponentNote"],
  ["library_loans", "LibraryLoan"], ["performance_records", "PerformanceRecord"],
  ["library_resources", "LibraryResource"],
  ...v5ArchiveTables.slice(22),
];
const v7ArchiveTables = [
  ...v6ArchiveTables.slice(0, 27),
  ["form_templates", "FormTemplate"], ["form_template_versions", "FormTemplateVersion"],
  ["form_questions", "FormQuestion"], ["form_campaigns", "FormCampaign"],
  ["form_requests", "FormRequest"], ["form_responses", "FormResponse"],
  ["form_answers", "FormAnswer"], ["form_uploads", "FormUpload"], ["form_reminders", "FormReminder"],
  ...v6ArchiveTables.slice(27),
];
const v8ArchiveTables = [
  ...v7ArchiveTables.slice(0, 36),
  ["event_series", "EventSeries"], ["events", "Event"], ["event_groups", "EventGroup"],
  ["event_participants", "EventParticipant"], ["event_rsvps", "EventRsvp"],
  ["attendance_records", "AttendanceRecord"], ["event_equipment_items", "EventEquipmentItem"],
  ["event_resources", "EventResource"], ["volunteer_opportunities", "VolunteerOpportunity"],
  ["volunteer_signups", "VolunteerSignup"], ["event_reminders", "EventReminder"],
  ["calendar_subscriptions", "CalendarSubscription"],
  ...v7ArchiveTables.slice(36),
];
const v9ArchiveTables = [
  ...v8ArchiveTables.slice(0, 48),
  ["migration_runs", "MigrationRun"], ["migration_sources", "MigrationSource"],
  ["migration_issues", "MigrationIssue"], ["external_references", "ExternalReference"],
  ...v8ArchiveTables.slice(48),
];

assert.deepEqual(runtimeAliasSegments("../../node_modules/better-sqlite3"), ["better-sqlite3"]);
assert.deepEqual(runtimeAliasSegments("D:\\a\\band-office\\band-office\\node_modules\\@prisma\\client"), ["@prisma", "client"]);
assert.throws(() => runtimeAliasSegments("D:\\a\\band-office\\outside-runtime"));
assert.throws(() => runtimeAliasSegments("../../node_modules/../outside-runtime"));

async function createInitialVersionDatabase(databasePath, programId, programName) {
  await mkdir(path.dirname(databasePath), { recursive: true });
  const database = new Database(databasePath);
  try {
    database.exec(await readFile(path.join(migrationsDirectory, firstMigration, "migration.sql"), "utf8"));
    database.exec('CREATE TABLE "_bandos_desktop_migrations" ("name" TEXT PRIMARY KEY, "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)');
    database.prepare('INSERT INTO "_bandos_desktop_migrations" ("name") VALUES (?)').run(firstMigration);
    database.prepare('INSERT INTO "Program" ("id", "name") VALUES (?, ?)').run(programId, programName);
    database.prepare('INSERT INTO "OperatingPeriod" ("id", "programId", "label", "startsAt", "periodKind") VALUES (?, ?, ?, ?, ?)').run(`${programId}-period`, programId, "2026-27", "2026-07-01T00:00:00.000Z", "school_year");
    database.prepare('INSERT INTO "Member" ("id", "programId", "firstName", "lastName", "grade", "section") VALUES (?, ?, ?, ?, ?, ?)').run(`${programId}-member`, programId, "Upgrade", "Student", 7, "clarinet");
    database.prepare('INSERT INTO "Asset" ("id", "programId", "category", "schoolAssetTag", "condition") VALUES (?, ?, ?, ?, ?)').run(`${programId}-asset`, programId, "EQUIPMENT", "UPGRADE-001", "GOOD");
    database.prepare('INSERT INTO "Assignment" ("id", "assetId", "memberId", "operatingPeriodId", "checkedOutAt", "conditionOut") VALUES (?, ?, ?, ?, ?, ?)').run(`${programId}-assignment`, `${programId}-asset`, `${programId}-member`, `${programId}-period`, "2026-07-15T12:00:00.000Z", "GOOD");
  } finally {
    database.close();
  }
}

async function createVersionTwoDatabase(databasePath, programId, programName) {
  await createInitialVersionDatabase(databasePath, programId, programName);
  const database = new Database(databasePath);
  try {
    for (const migration of ["20260720192637_release_hardening", "20260720192710_program_graduation_grade"]) {
      database.exec(await readFile(path.join(migrationsDirectory, migration, "migration.sql"), "utf8"));
      database.prepare('INSERT INTO "_bandos_desktop_migrations" ("name") VALUES (?)').run(migration);
    }
  } finally {
    database.close();
  }
}

async function createCurrentDatabase(databasePath, snapshotsDirectory, programId, programName) {
  await runDesktopMigrations({ databasePath, migrationsDirectory, snapshotsDirectory });
  const database = new Database(databasePath);
  try {
    database.prepare('INSERT INTO "Program" ("id", "name") VALUES (?, ?)').run(programId, programName);
  } finally {
    database.close();
  }
}

async function writeBackupArchive(databasePath, archivePath, overrides = {}, version = 9, libraryFiles = [], formFiles = [], eventFiles = []) {
  const database = new Database(databasePath, { readonly: true, fileMustExist: true });
  const zip = new JSZip();
  const archiveTables = version === 2 ? v2ArchiveTables : version === 3 ? v3ArchiveTables : version === 4 ? v4ArchiveTables : version === 5 ? v5ArchiveTables : version === 6 ? v6ArchiveTables : version === 7 ? v7ArchiveTables : version === 8 ? v8ArchiveTables : v9ArchiveTables;
  try {
    for (const [archiveName, tableName] of archiveTables) {
      const csv = archiveName in overrides ? overrides[archiveName] : Papa.unparse(database.prepare(`SELECT * FROM "${tableName}"`).all());
      if (csv !== null) zip.file(`${archiveName}.csv`, csv);
    }
    const program = database.prepare('SELECT "id" FROM "Program" LIMIT 1').get();
    for (const file of libraryFiles) zip.file(`library-files/${file.storageKey}`, file.bytes);
    for (const file of formFiles) zip.file(`form-files/${file.storageKey}`, file.bytes);
    for (const file of eventFiles) zip.file(`event-files/${file.storageKey}`, file.bytes);
    zip.file("manifest.json", JSON.stringify({ format: version < 8 ? "BandOS full backup" : "Band Office full backup", version, programId: program.id, createdAt: new Date().toISOString(), tables: archiveTables.map(([name]) => name), ...(version >= 6 ? { libraryFiles: libraryFiles.map(({ storageKey, contentHash, byteSize }) => ({ storageKey, contentHash, byteSize })) } : {}), ...(version >= 7 ? { formFiles: formFiles.map(({ storageKey, contentHash, byteSize }) => ({ storageKey, contentHash, byteSize })) } : {}), ...(version >= 8 ? { eventFiles: eventFiles.map(({ storageKey, contentHash, byteSize }) => ({ storageKey, contentHash, byteSize })) } : {}) }));
  } finally {
    database.close();
  }
  zip.file("bandos.db", await readFile(databasePath));
  await writeFile(archivePath, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}

const workDirectory = await mkdtemp(path.join(tmpdir(), "bandos-desktop-runtime-"));
const snapshotsDirectory = path.join(workDirectory, "snapshots");

try {
  const freshPath = path.join(workDirectory, "fresh", "bandos.db");
  const firstRun = await runDesktopMigrations({ databasePath: freshPath, migrationsDirectory, snapshotsDirectory });
  assert.equal(firstRun.applied.length, 12);
  const secondRun = await runDesktopMigrations({ databasePath: freshPath, migrationsDirectory, snapshotsDirectory });
  assert.deepEqual(secondRun.applied, []);

  const upgradePath = path.join(workDirectory, "upgrade", "bandos.db");
  const upgradeSnapshots = path.join(workDirectory, "upgrade-snapshots");
  await createInitialVersionDatabase(upgradePath, "upgrade-program", "Upgrade Program");
  const legacyDatabasePath = path.join(workDirectory, "legacy-v2", "bandos.db");
  await createVersionTwoDatabase(legacyDatabasePath, "legacy-program", "Legacy Program");
  const legacyArchivePath = path.join(workDirectory, "legacy-v2-backup.zip");
  await writeBackupArchive(legacyDatabasePath, legacyArchivePath, {}, 2);
  const legacyValidated = await validateBackupArchive(legacyArchivePath);
  assert.equal(legacyValidated.manifest.version, 2);
  assert.equal(legacyValidated.checkedTables, v2ArchiveTables.length);
  const upgrade = await runDesktopMigrations({ databasePath: upgradePath, migrationsDirectory, snapshotsDirectory: upgradeSnapshots });
  assert.deepEqual(upgrade.applied, ["20260720192637_release_hardening", "20260720192710_program_graduation_grade", "20260721120000_people_groups_access", "20260721180000_financial_ledger", "20260721204612_email_communications", "20260721212904_music_library", "20260722020643_forms", "20260724215148_events_attendance", "20260724233000_portal_password_recovery", "20260726143500_authentication_throttling", "20260802130000_cuttime_migration"]);
  assert.ok(upgrade.snapshotPath);
  const upgraded = new Database(upgradePath, { readonly: true });
  assert.equal(upgraded.prepare('SELECT "name" FROM "Program" WHERE "id" = ?').get("upgrade-program").name, "Upgrade Program");
  assert.equal(upgraded.prepare('SELECT "graduationGrade" FROM "Program" WHERE "id" = ?').get("upgrade-program").graduationGrade, 8);
  assert.equal(upgraded.prepare('SELECT COUNT(*) AS count FROM "Person"').get().count, 1);
  assert.equal(upgraded.prepare('SELECT "grade" FROM "StudentProfile" WHERE "personId" = ?').get("upgrade-program-member").grade, 7);
  assert.equal(upgraded.prepare('SELECT "name" FROM "Group"').get().name, "clarinet");
  assert.equal(upgraded.prepare('SELECT COUNT(*) AS count FROM "GroupMembership" WHERE "personId" = ?').get("upgrade-program-member").count, 1);
  const migratedAssignment = upgraded.prepare('SELECT "personId", "groupId" FROM "Assignment" WHERE "id" = ?').get("upgrade-program-assignment");
  assert.equal(migratedAssignment.personId, "upgrade-program-member");
  assert.ok(migratedAssignment.groupId);
  assert.equal(upgraded.prepare('SELECT COUNT(*) AS count FROM "Asset"').get().count, 1);
  assert.equal(upgraded.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name IN ('FinancialBatch', 'FinancialEntry')").get().count, 2);
  assert.equal(upgraded.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name IN ('PortalUser', 'PortalSession', 'PortalPasswordResetRequest')").get().count, 3);
  assert.equal(upgraded.pragma("integrity_check", { simple: true }), "ok");
  assert.equal(upgraded.pragma("foreign_key_check").length, 0);
  upgraded.close();
  const preUpgrade = new Database(upgrade.snapshotPath, { readonly: true });
  assert.equal(preUpgrade.prepare('SELECT "name" FROM "Program"').get().name, "Upgrade Program");
  assert.equal(preUpgrade.prepare("SELECT COUNT(*) AS count FROM pragma_table_info('Program') WHERE name = 'graduationGrade'").get().count, 0);
  preUpgrade.close();

  const failurePath = path.join(workDirectory, "failure", "bandos.db");
  const failureSnapshots = path.join(workDirectory, "failure-snapshots");
  await createCurrentDatabase(failurePath, failureSnapshots, "failure-program", "Migration Survivor");
  const failingMigrations = path.join(workDirectory, "failing-migrations");
  await cp(migrationsDirectory, failingMigrations, { recursive: true });
  const failingMigrationDirectory = path.join(failingMigrations, "99999999999999_forced_failure");
  await mkdir(failingMigrationDirectory, { recursive: true });
  await writeFile(path.join(failingMigrationDirectory, "migration.sql"), 'CREATE TABLE "MigrationProbe" ("id" TEXT PRIMARY KEY);\nTHIS IS NOT SQL;\n');
  await assert.rejects(runDesktopMigrations({ databasePath: failurePath, migrationsDirectory: failingMigrations, snapshotsDirectory: failureSnapshots }));
  const survived = new Database(failurePath, { readonly: true });
  assert.equal(survived.prepare('SELECT "name" FROM "Program"').get().name, "Migration Survivor");
  assert.equal(survived.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'MigrationProbe'").get().count, 0);
  assert.equal(survived.pragma("integrity_check", { simple: true }), "ok");
  survived.close();
  assert.ok((await readdir(failureSnapshots)).some((name) => name.startsWith("pre-migration-")));

  const restoreRoot = path.join(workDirectory, "restore");
  const dataDirectory = path.join(restoreRoot, "data");
  const restoreSnapshots = path.join(restoreRoot, "snapshots");
  const databasePath = path.join(dataDirectory, "bandos.db");
  await createCurrentDatabase(databasePath, restoreSnapshots, "current-program", "Current Program");
  const replacementPath = path.join(workDirectory, "replacement.db");
  await createCurrentDatabase(replacementPath, restoreSnapshots, "restored-program", "Restored Program");
  const libraryFileBytes = Buffer.from("verified managed library file");
  const libraryFileFixture = { storageKey: "library-test-item/verified-score.txt", contentHash: createHash("sha256").update(libraryFileBytes).digest("hex"), byteSize: libraryFileBytes.byteLength, bytes: libraryFileBytes };
  const replacementDatabase = new Database(replacementPath);
  replacementDatabase.prepare('INSERT INTO "LibraryItem" ("id", "programId", "title", "status", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?)').run("library-test-item", "restored-program", "Verified Score", "AVAILABLE", new Date().toISOString(), new Date().toISOString());
  replacementDatabase.prepare('INSERT INTO "LibraryResource" ("id", "itemId", "kind", "label", "fileName", "mimeType", "byteSize", "storageKey", "contentHash", "copyrightAcknowledgedAt", "status", "createdAt", "createdBy") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run("library-test-resource", "library-test-item", "LOCAL_FILE", "Verified file", "verified-score.txt", "text/plain", libraryFileFixture.byteSize, libraryFileFixture.storageKey, libraryFileFixture.contentHash, new Date().toISOString(), "ACTIVE", new Date().toISOString(), "test");
  const formFileBytes = Buffer.from("verified managed form file");
  const formFileFixture = { storageKey: "form-test-request/verified-response.txt", contentHash: createHash("sha256").update(formFileBytes).digest("hex"), byteSize: formFileBytes.byteLength, bytes: formFileBytes };
  replacementDatabase.prepare('INSERT INTO "FormTemplate" ("id", "programId", "name", "archived", "createdAt", "updatedAt", "createdBy") VALUES (?, ?, ?, ?, ?, ?, ?)').run("form-test-template", "restored-program", "Verified form", 0, new Date().toISOString(), new Date().toISOString(), "test");
  replacementDatabase.prepare('INSERT INTO "FormTemplateVersion" ("id", "templateId", "version", "status", "title", "createdAt", "publishedAt", "createdBy") VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run("form-test-version", "form-test-template", 1, "PUBLISHED", "Verified form", new Date().toISOString(), new Date().toISOString(), "test");
  replacementDatabase.prepare('INSERT INTO "FormQuestion" ("id", "versionId", "position", "prompt", "type", "required") VALUES (?, ?, ?, ?, ?, ?)').run("form-test-question", "form-test-version", 1, "Upload", "FILE_UPLOAD", 0);
  replacementDatabase.prepare('INSERT INTO "OperatingPeriod" ("id", "programId", "label", "startsAt", "periodKind") VALUES (?, ?, ?, ?, ?)').run("form-test-period", "restored-program", "2026-27", new Date().toISOString(), "school_year");
  replacementDatabase.prepare('INSERT INTO "Person" ("id", "programId", "firstName", "lastName", "status", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?)').run("form-test-person", "restored-program", "Verified", "Person", "ACTIVE", new Date().toISOString(), new Date().toISOString());
  replacementDatabase.prepare('INSERT INTO "FormCampaign" ("id", "programId", "operatingPeriodId", "templateVersionId", "name", "audienceType", "audienceSummary", "recipientMode", "createdAt", "createdBy") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run("form-test-campaign", "restored-program", "form-test-period", "form-test-version", "Verified campaign", "PERSON", "Verified Person", "STUDENTS", new Date().toISOString(), "test");
  replacementDatabase.prepare('INSERT INTO "FormRequest" ("id", "campaignId", "recipientPersonId", "subjectPersonId", "status", "createdAt") VALUES (?, ?, ?, ?, ?, ?)').run("form-test-request", "form-test-campaign", "form-test-person", "form-test-person", "COMPLETE", new Date().toISOString());
  replacementDatabase.prepare('INSERT INTO "FormResponse" ("id", "requestId", "status", "startedAt", "submittedAt", "recordedBy") VALUES (?, ?, ?, ?, ?, ?)').run("form-test-response", "form-test-request", "SUBMITTED", new Date().toISOString(), new Date().toISOString(), "test");
  replacementDatabase.prepare('INSERT INTO "FormUpload" ("id", "responseId", "questionId", "fileName", "mimeType", "byteSize", "storageKey", "contentHash", "status", "createdAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run("form-test-upload", "form-test-response", "form-test-question", "verified-response.txt", "text/plain", formFileFixture.byteSize, formFileFixture.storageKey, formFileFixture.contentHash, "ACTIVE", new Date().toISOString());
  const eventFileBytes = Buffer.from("verified managed event file");
  const eventFileFixture = { storageKey: "event-test/verified-itinerary.txt", contentHash: createHash("sha256").update(eventFileBytes).digest("hex"), byteSize: eventFileBytes.byteLength, bytes: eventFileBytes };
  replacementDatabase.prepare('INSERT INTO "Event" ("id", "programId", "operatingPeriodId", "name", "startsAt", "visibility", "status", "rsvpEnabled", "attendanceEnabled", "createdAt", "updatedAt", "createdBy") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run("event-test", "restored-program", "form-test-period", "Verified Event", new Date().toISOString(), "PRIVATE", "PUBLISHED", 0, 1, new Date().toISOString(), new Date().toISOString(), "test");
  replacementDatabase.prepare('INSERT INTO "EventResource" ("id", "eventId", "kind", "label", "fileName", "mimeType", "byteSize", "storageKey", "contentHash", "status", "createdAt", "createdBy") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run("event-test-resource", "event-test", "LOCAL_FILE", "Verified itinerary", "verified-itinerary.txt", "text/plain", eventFileFixture.byteSize, eventFileFixture.storageKey, eventFileFixture.contentHash, "ACTIVE", new Date().toISOString(), "test");
  replacementDatabase.close();
  const validArchivePath = path.join(workDirectory, "valid-backup.zip");
  await writeBackupArchive(replacementPath, validArchivePath, {}, 9, [libraryFileFixture], [formFileFixture], [eventFileFixture]);
  const validated = await validateBackupArchive(validArchivePath);
  assert.equal(validated.manifest.programId, "restored-program");
  assert.equal(validated.checkedTables, v9ArchiveTables.length);
  await writeFile(path.join(dataDirectory, PENDING_RESTORE_FILENAME), validated.databaseBytes, { mode: 0o600 });
  const pendingLibraryRoot = path.join(dataDirectory, PENDING_LIBRARY_RESTORE_DIRECTORY);
  for (const file of validated.libraryFiles) {
    const destination = path.join(pendingLibraryRoot, file.storageKey);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, file.bytes, { mode: 0o600 });
  }
  const pendingFormRoot = path.join(dataDirectory, PENDING_FORM_RESTORE_DIRECTORY);
  for (const file of validated.formFiles) {
    const destination = path.join(pendingFormRoot, file.storageKey);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, file.bytes, { mode: 0o600 });
  }
  const pendingEventRoot = path.join(dataDirectory, PENDING_EVENT_RESTORE_DIRECTORY);
  for (const file of validated.eventFiles) {
    const destination = path.join(pendingEventRoot, file.storageKey);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, file.bytes, { mode: 0o600 });
  }
  const snapshotPath = await applyPendingRestore({ dataDirectory, databasePath, snapshotsDirectory: restoreSnapshots });
  assert.ok(snapshotPath);
  const restored = new Database(databasePath, { readonly: true });
  assert.equal(restored.prepare('SELECT "name" FROM "Program"').get().name, "Restored Program");
  restored.close();
  assert.equal((await readFile(path.join(dataDirectory, "library-files", libraryFileFixture.storageKey))).toString(), libraryFileBytes.toString());
  assert.equal((await readFile(path.join(dataDirectory, "form-files", formFileFixture.storageKey))).toString(), formFileBytes.toString());
  assert.equal((await readFile(path.join(dataDirectory, "event-files", eventFileFixture.storageKey))).toString(), eventFileBytes.toString());
  const preserved = new Database(snapshotPath, { readonly: true });
  assert.equal(preserved.prepare('SELECT "name" FROM "Program"').get().name, "Current Program");
  preserved.close();
  await assert.rejects(stat(path.join(dataDirectory, PENDING_RESTORE_FILENAME)));

  const interruptedRoot = path.join(workDirectory, "interrupted");
  const interruptedData = path.join(interruptedRoot, "data");
  await mkdir(interruptedData, { recursive: true });
  await cp(snapshotPath, path.join(interruptedData, "bandos.restore-current.db"));
  await applyPendingRestore({ dataDirectory: interruptedData, databasePath: path.join(interruptedData, "bandos.db"), snapshotsDirectory: path.join(interruptedRoot, "snapshots") });
  const recovered = new Database(path.join(interruptedData, "bandos.db"), { readonly: true });
  assert.equal(recovered.prepare('SELECT "name" FROM "Program"').get().name, "Current Program");
  recovered.close();

  const demoResetRoot = path.join(workDirectory, "demo-reset");
  const demoData = path.join(demoResetRoot, "data");
  const demoSnapshots = path.join(demoResetRoot, "snapshots");
  const demoDatabasePath = path.join(demoData, "bandos.db");
  await createCurrentDatabase(demoDatabasePath, demoSnapshots, RIDGELINE_DEMO_PROGRAM_ID, "Ridgeline Middle School Band");
  assert.doesNotThrow(() => assertRidgelineDemoDatabase(demoDatabasePath));
  for (const [directory, fileName] of [
    ["library-files", "score.pdf"],
    ["form-files", "permission-slip.pdf"],
    ["event-files", "itinerary.pdf"],
  ]) {
    const managedDirectory = path.join(demoData, directory, "demo-record");
    await mkdir(managedDirectory, { recursive: true });
    await writeFile(path.join(managedDirectory, fileName), `preserved ${directory}`);
  }
  await writeFile(path.join(demoData, PENDING_DEMO_RESET_FILENAME), "pending\n", { mode: 0o600 });
  const demoReset = await applyPendingDemoReset({
    dataDirectory: demoData,
    databasePath: demoDatabasePath,
    snapshotsDirectory: demoSnapshots,
  });
  assert.ok(demoReset?.snapshotPath);
  const preservedDemo = new Database(demoReset.snapshotPath, { readonly: true });
  assert.equal(preservedDemo.prepare('SELECT "name" FROM "Program"').get().name, "Ridgeline Middle School Band");
  preservedDemo.close();
  for (const [directory, fileName] of [
    ["library-files", "score.pdf"],
    ["form-files", "permission-slip.pdf"],
    ["event-files", "itinerary.pdf"],
  ]) {
    await assert.rejects(stat(path.join(demoData, directory)));
    const preservedDirectory = (await readdir(demoSnapshots)).find((name) => name.startsWith("pre-demo-reset-") && name.endsWith(`-${directory}`));
    assert.ok(preservedDirectory);
    assert.equal(
      (await readFile(path.join(demoSnapshots, preservedDirectory, "demo-record", fileName), "utf8")),
      `preserved ${directory}`,
    );
  }
  await assert.rejects(stat(path.join(demoData, PENDING_DEMO_RESET_FILENAME)));
  await runDesktopMigrations({ databasePath: demoDatabasePath, migrationsDirectory, snapshotsDirectory: demoSnapshots });
  const emptyProgram = new Database(demoDatabasePath, { readonly: true });
  assert.equal(emptyProgram.prepare('SELECT COUNT(*) AS count FROM "Program"').get().count, 0);
  emptyProgram.close();

  const nonDemoPath = path.join(workDirectory, "non-demo", "bandos.db");
  await createCurrentDatabase(nonDemoPath, path.join(workDirectory, "non-demo-snapshots"), "my-program", "My Program");
  assert.throws(() => assertRidgelineDemoDatabase(nonDemoPath), /Only the fictional Ridgeline demo/);

  const interruptedDemoResetData = path.join(workDirectory, "interrupted-demo-reset", "data");
  await mkdir(path.join(interruptedDemoResetData, "library-files"), { recursive: true });
  await writeFile(path.join(interruptedDemoResetData, "library-files", "partial.txt"), "partial");
  await writeFile(path.join(interruptedDemoResetData, PENDING_DEMO_RESET_FILENAME), "pending\n", { mode: 0o600 });
  const resumedDemoReset = await applyPendingDemoReset({
    dataDirectory: interruptedDemoResetData,
    databasePath: path.join(interruptedDemoResetData, "bandos.db"),
    snapshotsDirectory: path.join(workDirectory, "interrupted-demo-reset", "snapshots"),
  });
  assert.deepEqual(resumedDemoReset, { snapshotPath: null });
  await assert.rejects(stat(path.join(interruptedDemoResetData, PENDING_DEMO_RESET_FILENAME)));
  await assert.rejects(stat(path.join(interruptedDemoResetData, "library-files")));

  const mismatchedArchivePath = path.join(workDirectory, "mismatched-backup.zip");
  await writeBackupArchive(replacementPath, mismatchedArchivePath, { components: "id,assetId,name,status,notes\nextra,missing,Case,PRESENT," }, 8, [libraryFileFixture], [formFileFixture], [eventFileFixture]);
  await assert.rejects(validateBackupArchive(mismatchedArchivePath), /components\.csv does not match/);

  console.log("Desktop acceptance verified: fresh install, idempotent restart, historical upgrade, migration rollback, archive validation, restore preservation, demo reset preservation, and interrupted recovery.");
} finally {
  await rm(workDirectory, { recursive: true, force: true });
}
