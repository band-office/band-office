import Database from "better-sqlite3";
import JSZip from "jszip";
import Papa from "papaparse";
import { createDecipheriv, createHash, scryptSync } from "node:crypto";
import { mkdtemp, open, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const MAGIC = "BANDOSENC1";
const MAX_ARCHIVE_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_DATABASE_BYTES = 1024 * 1024 * 1024;
const MAX_CSV_BYTES = 256 * 1024 * 1024;
const MAX_LIBRARY_FILE_BYTES = 25 * 1024 * 1024;
const MAX_FORM_FILE_BYTES = 15 * 1024 * 1024;
const MAX_EVENT_FILE_BYTES = 15 * 1024 * 1024;
const V2_TABLES = [
  ["programs", "Program"], ["members", "Member"], ["assets", "Asset"], ["components", "AssetComponent"],
  ["assignments", "Assignment"], ["repairs", "Repair"], ["operating_periods", "OperatingPeriod"],
  ["audit_log", "AuditLog"], ["backup_records", "BackupRecord"],
];
const V3_TABLES = [
  ["programs", "Program"], ["people", "Person"], ["student_profiles", "StudentProfile"],
  ["person_classifications", "PersonClassification"], ["groups", "Group"], ["group_memberships", "GroupMembership"],
  ["guardian_students", "GuardianStudent"], ["assets", "Asset"], ["components", "AssetComponent"],
  ["assignments", "Assignment"], ["repairs", "Repair"], ["operating_periods", "OperatingPeriod"],
  ["audit_log", "AuditLog"], ["backup_records", "BackupRecord"],
];
const V4_TABLES = [
  ["programs", "Program"], ["people", "Person"], ["student_profiles", "StudentProfile"],
  ["person_classifications", "PersonClassification"], ["groups", "Group"], ["group_memberships", "GroupMembership"],
  ["guardian_students", "GuardianStudent"], ["assets", "Asset"], ["components", "AssetComponent"],
  ["assignments", "Assignment"], ["repairs", "Repair"], ["financial_batches", "FinancialBatch"],
  ["financial_entries", "FinancialEntry"], ["operating_periods", "OperatingPeriod"],
  ["audit_log", "AuditLog"], ["backup_records", "BackupRecord"],
];
const V5_TABLES = [
  ...V4_TABLES.slice(0, 13),
  ["email_connections", "EmailConnection"], ["email_contact_states", "EmailContactState"],
  ["email_templates", "EmailTemplate"], ["announcements", "Announcement"],
  ["announcement_audience_targets", "AnnouncementAudienceTarget"], ["announcement_recipients", "AnnouncementRecipient"],
  ["announcement_attachments", "AnnouncementAttachment"], ["delivery_attempts", "DeliveryAttempt"],
  ["communication_jobs", "CommunicationJob"],
  ...V4_TABLES.slice(13),
];
const V6_TABLES = [
  ...V5_TABLES.slice(0, 22),
  ["library_items", "LibraryItem"], ["library_component_notes", "LibraryComponentNote"],
  ["library_loans", "LibraryLoan"], ["performance_records", "PerformanceRecord"],
  ["library_resources", "LibraryResource"],
  ...V5_TABLES.slice(22),
];
const V7_TABLES = [
  ...V6_TABLES.slice(0, 27),
  ["form_templates", "FormTemplate"], ["form_template_versions", "FormTemplateVersion"],
  ["form_questions", "FormQuestion"], ["form_campaigns", "FormCampaign"],
  ["form_requests", "FormRequest"], ["form_responses", "FormResponse"],
  ["form_answers", "FormAnswer"], ["form_uploads", "FormUpload"], ["form_reminders", "FormReminder"],
  ...V6_TABLES.slice(27),
];
const V8_TABLES = [
  ...V7_TABLES.slice(0, 36),
  ["event_series", "EventSeries"], ["events", "Event"], ["event_groups", "EventGroup"],
  ["event_participants", "EventParticipant"], ["event_rsvps", "EventRsvp"],
  ["attendance_records", "AttendanceRecord"], ["event_equipment_items", "EventEquipmentItem"],
  ["event_resources", "EventResource"], ["volunteer_opportunities", "VolunteerOpportunity"],
  ["volunteer_signups", "VolunteerSignup"], ["event_reminders", "EventReminder"],
  ["calendar_subscriptions", "CalendarSubscription"],
  ...V7_TABLES.slice(36),
];
const V9_TABLES = [
  ...V8_TABLES.slice(0, 48),
  ["migration_runs", "MigrationRun"], ["migration_sources", "MigrationSource"],
  ["migration_issues", "MigrationIssue"], ["external_references", "ExternalReference"],
  ...V8_TABLES.slice(48),
];

function validateStorageKey(value) {
  if (typeof value !== "string" || !value || value.includes("\\") || path.posix.isAbsolute(value)) throw new Error("Backup contains an invalid managed file key.");
  const normalized = path.posix.normalize(value);
  if (normalized !== value || normalized === ".." || normalized.startsWith("../")) throw new Error("Backup contains an unsafe managed file key.");
  return value;
}

async function readBoundedEntry(zip, name, limit) {
  const bytes = await zip.file(name).async("uint8array");
  if (bytes.byteLength > limit) throw new Error(`${name} exceeds the restore size limit.`);
  return Buffer.from(bytes);
}

async function readBoundedFile(file, limit, message) {
  const chunks = [];
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  let total = 0;
  while (true) {
    const remaining = limit - total;
    const { bytesRead } = await file.read(buffer, 0, Math.min(buffer.byteLength, remaining + 1), null);
    if (bytesRead === 0) break;
    total += bytesRead;
    if (total > limit) throw new Error(message);
    chunks.push(Buffer.from(buffer.subarray(0, bytesRead)));
  }
  return Buffer.concat(chunks, total);
}

function decrypt(source, passphrase) {
  if (source.subarray(0, MAGIC.length).toString() !== MAGIC) return source;
  if (!passphrase) throw new Error("This encrypted backup requires its passphrase.");
  const firstBreak = source.indexOf(10);
  const secondBreak = source.indexOf(10, firstBreak + 1);
  if (firstBreak !== MAGIC.length || secondBreak < 0 || secondBreak > 4096) throw new Error("The encrypted backup header is invalid.");
  const header = JSON.parse(source.subarray(firstBreak + 1, secondBreak).toString());
  if (![header.salt, header.iv, header.tag].every((value) => typeof value === "string")) throw new Error("The encrypted backup header is incomplete.");
  const decipher = createDecipheriv("aes-256-gcm", scryptSync(passphrase, Buffer.from(header.salt, "base64"), 32), Buffer.from(header.iv, "base64"));
  decipher.setAuthTag(Buffer.from(header.tag, "base64"));
  return Buffer.concat([decipher.update(source.subarray(secondBreak + 1)), decipher.final()]);
}

export async function validateBackupArchive(archivePath, passphrase = "") {
  const archive = await open(archivePath, "r");
  let archiveBytes;
  try {
    archiveBytes = await readBoundedFile(archive, MAX_ARCHIVE_BYTES, "The selected archive exceeds the 2 GB desktop restore limit.");
  } finally {
    await archive.close();
  }
  const zip = await JSZip.loadAsync(decrypt(archiveBytes, passphrase));
  for (const name of ["manifest.json", "bandos.db"]) if (!zip.file(name)) throw new Error(`Backup is missing ${name}.`);
  const manifest = JSON.parse((await readBoundedEntry(zip, "manifest.json", 1024 * 1024)).toString("utf8"));
  if (!["BandOS full backup", "Band Office full backup"].includes(manifest.format) || ![2, 3, 4, 5, 6, 7, 8, 9].includes(manifest.version) || typeof manifest.programId !== "string" || !Array.isArray(manifest.tables)) throw new Error("Backup manifest is invalid or unsupported.");
  const requiredTables = manifest.version === 2 ? V2_TABLES : manifest.version === 3 ? V3_TABLES : manifest.version === 4 ? V4_TABLES : manifest.version === 5 ? V5_TABLES : manifest.version === 6 ? V6_TABLES : manifest.version === 7 ? V7_TABLES : manifest.version === 8 ? V8_TABLES : V9_TABLES;
  for (const [name] of requiredTables) {
    if (!manifest.tables.includes(name)) throw new Error(`Backup manifest is missing table ${name}.`);
    if (!zip.file(`${name}.csv`)) throw new Error(`Backup is missing ${name}.csv.`);
  }

  const workDirectory = await mkdtemp(path.join(tmpdir(), "bandos-restore-check-"));
  const restoredDatabasePath = path.join(workDirectory, "bandos.db");
  const libraryFiles = [];
  const formFiles = [];
  const eventFiles = [];
  try {
    const databaseBytes = await readBoundedEntry(zip, "bandos.db", MAX_DATABASE_BYTES);
    await writeFile(restoredDatabasePath, databaseBytes, { mode: 0o600 });
    const database = new Database(restoredDatabasePath, { readonly: true, fileMustExist: true });
    try {
      if (database.pragma("integrity_check", { simple: true }) !== "ok") throw new Error("SQLite integrity check failed.");
      if (database.pragma("foreign_key_check").length > 0) throw new Error("SQLite foreign-key check failed.");
      const program = database.prepare('SELECT id FROM "Program" WHERE id = ?').get(manifest.programId);
      if (!program) throw new Error("Backup manifest does not match its SQLite program.");
      for (const [archiveName, tableName] of requiredTables) {
        const csvName = `${archiveName}.csv`;
        const csv = (await readBoundedEntry(zip, csvName, MAX_CSV_BYTES)).toString("utf8");
        const parsed = csv.trim() ? Papa.parse(csv, { header: true, skipEmptyLines: true }) : { data: [], errors: [] };
        if (parsed.errors.length) throw new Error(`${csvName} is malformed: ${parsed.errors[0].message}`);
        const count = database.prepare(`SELECT COUNT(*) AS count FROM "${tableName}"`).get().count;
        if (count !== parsed.data.length) throw new Error(`${csvName} does not match the SQLite record count.`);
      }
      if (manifest.version >= 6) {
        if (!Array.isArray(manifest.libraryFiles)) throw new Error("Backup manifest is missing its managed library file inventory.");
        const expected = database.prepare(`SELECT "storageKey", "contentHash", "byteSize" FROM "LibraryResource" WHERE "kind" = 'LOCAL_FILE' AND "status" = 'ACTIVE' ORDER BY "storageKey"`).all();
        const declared = [...manifest.libraryFiles].sort((left, right) => String(left.storageKey).localeCompare(String(right.storageKey)));
        if (expected.length !== declared.length) throw new Error("Backup library file inventory does not match its SQLite records.");
        for (let index = 0; index < expected.length; index += 1) {
          const record = expected[index];
          const entry = declared[index];
          const storageKey = validateStorageKey(entry.storageKey);
          if (storageKey !== record.storageKey || entry.contentHash !== record.contentHash || entry.byteSize !== record.byteSize) throw new Error("Backup library file metadata does not match its SQLite record.");
          const bytes = await readBoundedEntry(zip, `library-files/${storageKey}`, MAX_LIBRARY_FILE_BYTES);
          if (bytes.byteLength !== record.byteSize || createHash("sha256").update(bytes).digest("hex") !== record.contentHash) throw new Error(`Managed library file ${storageKey} failed verification.`);
          libraryFiles.push({ storageKey, bytes });
        }
      }
      if (manifest.version >= 7) {
        if (!Array.isArray(manifest.formFiles)) throw new Error("Backup manifest is missing its managed form file inventory.");
        const expected = database.prepare(`SELECT "storageKey", "contentHash", "byteSize" FROM "FormUpload" WHERE "status" = 'ACTIVE' ORDER BY "storageKey"`).all();
        const declared = [...manifest.formFiles].sort((left, right) => String(left.storageKey).localeCompare(String(right.storageKey)));
        if (expected.length !== declared.length) throw new Error("Backup form file inventory does not match its SQLite records.");
        for (let index = 0; index < expected.length; index += 1) {
          const record = expected[index];
          const entry = declared[index];
          const storageKey = validateStorageKey(entry.storageKey);
          if (storageKey !== record.storageKey || entry.contentHash !== record.contentHash || entry.byteSize !== record.byteSize) throw new Error("Backup form file metadata does not match its SQLite record.");
          const bytes = await readBoundedEntry(zip, `form-files/${storageKey}`, MAX_FORM_FILE_BYTES);
          if (bytes.byteLength !== record.byteSize || createHash("sha256").update(bytes).digest("hex") !== record.contentHash) throw new Error(`Managed form file ${storageKey} failed verification.`);
          formFiles.push({ storageKey, bytes });
        }
      }
      if (manifest.version >= 8) {
        if (!Array.isArray(manifest.eventFiles)) throw new Error("Backup manifest is missing its managed event file inventory.");
        const expected = database.prepare(`SELECT "storageKey", "contentHash", "byteSize" FROM "EventResource" WHERE "kind" = 'LOCAL_FILE' AND "status" = 'ACTIVE' ORDER BY "storageKey"`).all();
        const declared = [...manifest.eventFiles].sort((left, right) => String(left.storageKey).localeCompare(String(right.storageKey)));
        if (expected.length !== declared.length) throw new Error("Backup event file inventory does not match its SQLite records.");
        for (let index = 0; index < expected.length; index += 1) {
          const record = expected[index];
          const entry = declared[index];
          const storageKey = validateStorageKey(entry.storageKey);
          if (storageKey !== record.storageKey || entry.contentHash !== record.contentHash || entry.byteSize !== record.byteSize) throw new Error("Backup event file metadata does not match its SQLite record.");
          const bytes = await readBoundedEntry(zip, `event-files/${storageKey}`, MAX_EVENT_FILE_BYTES);
          if (bytes.byteLength !== record.byteSize || createHash("sha256").update(bytes).digest("hex") !== record.contentHash) throw new Error(`Managed event file ${storageKey} failed verification.`);
          eventFiles.push({ storageKey, bytes });
        }
      }
    } finally {
      database.close();
    }
    return { databaseBytes, libraryFiles, formFiles, eventFiles, manifest, checkedTables: requiredTables.length };
  } finally {
    await rm(workDirectory, { recursive: true, force: true });
  }
}
