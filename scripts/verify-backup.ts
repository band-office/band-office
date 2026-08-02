import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import Database from "better-sqlite3";
import JSZip from "jszip";
import Papa from "papaparse";
import { createDecipheriv, scryptSync } from "node:crypto";

const archivePath = process.argv[2];
if (!archivePath) throw new Error("Usage: npm run backup:verify -- /path/to/band-office-backup.bandoffice");

const source = readFileSync(archivePath);
let zipBytes = source;
if (source.subarray(0, 10).toString() === "BANDOSENC1") {
  const firstBreak = source.indexOf(10);
  const secondBreak = source.indexOf(10, firstBreak + 1);
  const header = JSON.parse(source.subarray(firstBreak + 1, secondBreak).toString()) as { salt: string; iv: string; tag: string };
  const passphrase = process.argv[3] || process.env.BANDOS_BACKUP_PASSPHRASE;
  if (!passphrase) throw new Error("Encrypted backup requires a passphrase as the second argument or BANDOS_BACKUP_PASSPHRASE.");
  const decipher = createDecipheriv("aes-256-gcm", scryptSync(passphrase, Buffer.from(header.salt, "base64"), 32), Buffer.from(header.iv, "base64"));
  decipher.setAuthTag(Buffer.from(header.tag, "base64"));
  zipBytes = Buffer.concat([decipher.update(source.subarray(secondBreak + 1)), decipher.final()]);
}
const zip = await JSZip.loadAsync(zipBytes);
const v2Checks: Array<[string, string]> = [
  ["programs.csv", "Program"], ["members.csv", "Member"], ["assets.csv", "Asset"],
  ["components.csv", "AssetComponent"], ["assignments.csv", "Assignment"], ["repairs.csv", "Repair"],
  ["operating_periods.csv", "OperatingPeriod"], ["audit_log.csv", "AuditLog"], ["backup_records.csv", "BackupRecord"],
];
const v3Checks: Array<[string, string]> = [
  ["programs.csv", "Program"], ["people.csv", "Person"], ["student_profiles.csv", "StudentProfile"],
  ["person_classifications.csv", "PersonClassification"], ["groups.csv", "Group"], ["group_memberships.csv", "GroupMembership"],
  ["guardian_students.csv", "GuardianStudent"], ["assets.csv", "Asset"], ["components.csv", "AssetComponent"],
  ["assignments.csv", "Assignment"], ["repairs.csv", "Repair"], ["operating_periods.csv", "OperatingPeriod"],
  ["audit_log.csv", "AuditLog"], ["backup_records.csv", "BackupRecord"],
];
const v4Checks: Array<[string, string]> = [
  ["programs.csv", "Program"], ["people.csv", "Person"], ["student_profiles.csv", "StudentProfile"],
  ["person_classifications.csv", "PersonClassification"], ["groups.csv", "Group"], ["group_memberships.csv", "GroupMembership"],
  ["guardian_students.csv", "GuardianStudent"], ["assets.csv", "Asset"], ["components.csv", "AssetComponent"],
  ["assignments.csv", "Assignment"], ["repairs.csv", "Repair"], ["financial_batches.csv", "FinancialBatch"],
  ["financial_entries.csv", "FinancialEntry"], ["operating_periods.csv", "OperatingPeriod"],
  ["audit_log.csv", "AuditLog"], ["backup_records.csv", "BackupRecord"],
];
const v5Checks: Array<[string, string]> = [
  ...v4Checks.slice(0, 13),
  ["email_connections.csv", "EmailConnection"], ["email_contact_states.csv", "EmailContactState"],
  ["email_templates.csv", "EmailTemplate"], ["announcements.csv", "Announcement"],
  ["announcement_audience_targets.csv", "AnnouncementAudienceTarget"], ["announcement_recipients.csv", "AnnouncementRecipient"],
  ["announcement_attachments.csv", "AnnouncementAttachment"], ["delivery_attempts.csv", "DeliveryAttempt"],
  ["communication_jobs.csv", "CommunicationJob"],
  ...v4Checks.slice(13),
];
const v6Checks: Array<[string, string]> = [
  ...v5Checks.slice(0, 22),
  ["library_items.csv", "LibraryItem"], ["library_component_notes.csv", "LibraryComponentNote"],
  ["library_loans.csv", "LibraryLoan"], ["performance_records.csv", "PerformanceRecord"],
  ["library_resources.csv", "LibraryResource"],
  ...v5Checks.slice(22),
];
const v7Checks: Array<[string, string]> = [
  ...v6Checks.slice(0, 27),
  ["form_templates.csv", "FormTemplate"], ["form_template_versions.csv", "FormTemplateVersion"],
  ["form_questions.csv", "FormQuestion"], ["form_campaigns.csv", "FormCampaign"],
  ["form_requests.csv", "FormRequest"], ["form_responses.csv", "FormResponse"],
  ["form_answers.csv", "FormAnswer"], ["form_uploads.csv", "FormUpload"], ["form_reminders.csv", "FormReminder"],
  ...v6Checks.slice(27),
];
const v8Checks: Array<[string, string]> = [
  ...v7Checks.slice(0, 36),
  ["event_series.csv", "EventSeries"], ["events.csv", "Event"], ["event_groups.csv", "EventGroup"],
  ["event_participants.csv", "EventParticipant"], ["event_rsvps.csv", "EventRsvp"],
  ["attendance_records.csv", "AttendanceRecord"], ["event_equipment_items.csv", "EventEquipmentItem"],
  ["event_resources.csv", "EventResource"], ["volunteer_opportunities.csv", "VolunteerOpportunity"],
  ["volunteer_signups.csv", "VolunteerSignup"], ["event_reminders.csv", "EventReminder"],
  ["calendar_subscriptions.csv", "CalendarSubscription"],
  ...v7Checks.slice(36),
];
const v9Checks: Array<[string, string]> = [
  ...v8Checks.slice(0, 48),
  ["migration_runs.csv", "MigrationRun"], ["migration_sources.csv", "MigrationSource"],
  ["migration_issues.csv", "MigrationIssue"], ["external_references.csv", "ExternalReference"],
  ...v8Checks.slice(48),
];
const required = ["manifest.json", "bandos.db"];
for (const name of required) if (!zip.file(name)) throw new Error(`Backup is missing ${name}.`);

const manifest = JSON.parse(await zip.file("manifest.json")!.async("string")) as { format?: string; version?: number; programId?: string; tables?: string[] };
if (!["BandOS full backup", "Band Office full backup"].includes(manifest.format ?? "") || !manifest.programId || ![2, 3, 4, 5, 6, 7, 8, 9].includes(manifest.version ?? 0) || !Array.isArray(manifest.tables)) throw new Error("Backup manifest is invalid or unsupported.");
const checks = manifest.version === 2 ? v2Checks : manifest.version === 3 ? v3Checks : manifest.version === 4 ? v4Checks : manifest.version === 5 ? v5Checks : manifest.version === 6 ? v6Checks : manifest.version === 7 ? v7Checks : manifest.version === 8 ? v8Checks : v9Checks;
for (const [csvName] of checks) {
  const archiveName = csvName.replace(/\.csv$/, "");
  if (!manifest.tables.includes(archiveName) || !zip.file(csvName)) throw new Error(`Backup is missing ${csvName}.`);
}

const work = mkdtempSync(join(tmpdir(), "bandos-verify-"));
const databasePath = join(work, "bandos.db");
try {
  writeFileSync(databasePath, await zip.file("bandos.db")!.async("nodebuffer"));
  const database = new Database(databasePath, { readonly: true, fileMustExist: true });
  const integrity = database.pragma("integrity_check", { simple: true });
  if (integrity !== "ok") throw new Error(`SQLite integrity check failed: ${integrity}`);
  const foreignKeyFailures = database.pragma("foreign_key_check") as unknown[];
  if (foreignKeyFailures.length > 0) throw new Error("SQLite foreign-key check failed.");

  for (const [csvName, tableName] of checks) {
    const csv = await zip.file(csvName)!.async("string");
    const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
    if (parsed.errors.length) throw new Error(`${csvName} is malformed: ${parsed.errors[0].message}`);
    const databaseCount = (database.prepare(`SELECT COUNT(*) AS count FROM "${tableName}"`).get() as { count: number }).count;
    if (databaseCount !== parsed.data.length) throw new Error(`${csvName} has ${parsed.data.length} rows but SQLite has ${databaseCount}.`);
  }
  database.close();
  console.log(`Verified ${basename(archivePath)}: manifest v${manifest.version}, SQLite integrity and foreign keys ok, ${checks.length} CSV table counts match.`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
