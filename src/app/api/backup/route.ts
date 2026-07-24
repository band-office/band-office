import JSZip from "jszip";
import Database from "better-sqlite3";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createCipheriv, createHash, randomBytes, randomUUID, scryptSync } from "node:crypto";
import { getDatabaseFilePath, getDb } from "@/lib/db";
import { rowsToCsv } from "@/lib/csv";
import { hasPermission, requireApiUser } from "@/lib/auth";
import { resolveLibraryStorageKey } from "@/lib/library-storage";
import { resolveFormStorageKey } from "@/lib/form-storage";
import { resolveEventStorageKey } from "@/lib/event-storage";

export const dynamic = "force-dynamic";

const BACKUP_TABLES = [
  ["programs", "Program"],
  ["people", "Person"],
  ["student_profiles", "StudentProfile"],
  ["person_classifications", "PersonClassification"],
  ["groups", "Group"],
  ["group_memberships", "GroupMembership"],
  ["guardian_students", "GuardianStudent"],
  ["assets", "Asset"],
  ["components", "AssetComponent"],
  ["assignments", "Assignment"],
  ["repairs", "Repair"],
  ["financial_batches", "FinancialBatch"],
  ["financial_entries", "FinancialEntry"],
  ["email_connections", "EmailConnection"],
  ["email_contact_states", "EmailContactState"],
  ["email_templates", "EmailTemplate"],
  ["announcements", "Announcement"],
  ["announcement_audience_targets", "AnnouncementAudienceTarget"],
  ["announcement_recipients", "AnnouncementRecipient"],
  ["announcement_attachments", "AnnouncementAttachment"],
  ["delivery_attempts", "DeliveryAttempt"],
  ["communication_jobs", "CommunicationJob"],
  ["library_items", "LibraryItem"],
  ["library_component_notes", "LibraryComponentNote"],
  ["library_loans", "LibraryLoan"],
  ["performance_records", "PerformanceRecord"],
  ["library_resources", "LibraryResource"],
  ["form_templates", "FormTemplate"],
  ["form_template_versions", "FormTemplateVersion"],
  ["form_questions", "FormQuestion"],
  ["form_campaigns", "FormCampaign"],
  ["form_requests", "FormRequest"],
  ["form_responses", "FormResponse"],
  ["form_answers", "FormAnswer"],
  ["form_uploads", "FormUpload"],
  ["form_reminders", "FormReminder"],
  ["event_series", "EventSeries"],
  ["events", "Event"],
  ["event_groups", "EventGroup"],
  ["event_participants", "EventParticipant"],
  ["event_rsvps", "EventRsvp"],
  ["attendance_records", "AttendanceRecord"],
  ["event_equipment_items", "EventEquipmentItem"],
  ["event_resources", "EventResource"],
  ["volunteer_opportunities", "VolunteerOpportunity"],
  ["volunteer_signups", "VolunteerSignup"],
  ["event_reminders", "EventReminder"],
  ["calendar_subscriptions", "CalendarSubscription"],
  ["operating_periods", "OperatingPeriod"],
  ["audit_log", "AuditLog"],
  ["backup_records", "BackupRecord"],
] as const;

async function buildArchive() {
  const sourcePath = getDatabaseFilePath();
  const workDirectory = await mkdtemp(path.join(tmpdir(), "bandos-backup-"));
  const snapshotPath = path.join(workDirectory, "bandos.db");
  const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
  try {
    await source.backup(snapshotPath);
  } finally {
    source.close();
  }

  try {
    const snapshot = new Database(snapshotPath, { readonly: true, fileMustExist: true });
    let programId = "";
    let libraryFiles: Array<{ storageKey: string; contentHash: string; byteSize: number }> = [];
    let formFiles: Array<{ storageKey: string; contentHash: string; byteSize: number }> = [];
    let eventFiles: Array<{ storageKey: string; contentHash: string; byteSize: number }> = [];
    const tables: Record<string, Array<Record<string, unknown>>> = {};
    try {
      if (snapshot.pragma("integrity_check", { simple: true }) !== "ok") throw new Error("The database snapshot failed its integrity check.");
      const program = snapshot.prepare('SELECT "id" FROM "Program" ORDER BY "name" LIMIT 1').get() as { id?: string } | undefined;
      if (!program?.id) throw new Error("The database snapshot has no program record.");
      programId = program.id;
      for (const [archiveName, tableName] of BACKUP_TABLES) tables[archiveName] = snapshot.prepare(`SELECT * FROM "${tableName}"`).all() as Array<Record<string, unknown>>;
      libraryFiles = snapshot.prepare(`SELECT "storageKey", "contentHash", "byteSize" FROM "LibraryResource" WHERE "kind" = 'LOCAL_FILE' AND "status" = 'ACTIVE'`).all() as Array<{ storageKey: string; contentHash: string; byteSize: number }>;
      formFiles = snapshot.prepare(`SELECT "storageKey", "contentHash", "byteSize" FROM "FormUpload" WHERE "status" = 'ACTIVE'`).all() as Array<{ storageKey: string; contentHash: string; byteSize: number }>;
      eventFiles = snapshot.prepare(`SELECT "storageKey", "contentHash", "byteSize" FROM "EventResource" WHERE "kind" = 'LOCAL_FILE' AND "status" = 'ACTIVE'`).all() as Array<{ storageKey: string; contentHash: string; byteSize: number }>;
    } finally {
      snapshot.close();
    }

    const zip = new JSZip();
    for (const [name, rows] of Object.entries(tables)) zip.file(`${name}.csv`, rowsToCsv(rows));
    for (const file of libraryFiles) {
      const bytes = await readFile(resolveLibraryStorageKey(file.storageKey));
      if (bytes.byteLength !== file.byteSize || createHash("sha256").update(bytes).digest("hex") !== file.contentHash) throw new Error(`Managed library file ${file.storageKey} does not match its database record.`);
      zip.file(`library-files/${file.storageKey}`, bytes);
    }
    for (const file of formFiles) {
      const bytes = await readFile(resolveFormStorageKey(file.storageKey));
      if (bytes.byteLength !== file.byteSize || createHash("sha256").update(bytes).digest("hex") !== file.contentHash) throw new Error(`Managed form file ${file.storageKey} does not match its database record.`);
      zip.file(`form-files/${file.storageKey}`, bytes);
    }
    for (const file of eventFiles) {
      const bytes = await readFile(resolveEventStorageKey(file.storageKey));
      if (bytes.byteLength !== file.byteSize || createHash("sha256").update(bytes).digest("hex") !== file.contentHash) throw new Error(`Managed event file ${file.storageKey} does not match its database record.`);
      zip.file(`event-files/${file.storageKey}`, bytes);
    }
    zip.file("bandos.db", await readFile(snapshotPath));
    zip.file("manifest.json", JSON.stringify({ format: "BandOS full backup", version: 8, programId, createdAt: new Date().toISOString(), tables: Object.keys(tables), libraryFiles, formFiles, eventFiles, verification: "npm run backup:verify -- <archive>" }, null, 2));
    return { archive: Buffer.from(await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" })), program: { id: programId } };
  } finally {
    await rm(workDirectory, { recursive: true, force: true });
  }
}

async function recordBackup(payload: Buffer, filename: string, programId: string, actor: string) {
  const db = getDb();
  const sha256 = createHash("sha256").update(payload).digest("hex");
  await db.$transaction([
    db.backupRecord.create({ data: { id: randomUUID(), programId, filename, sha256 } }),
    db.auditLog.create({ data: { id: randomUUID(), programId, actor, action: "EXPORT", entityType: "Backup", entityId: programId, changeSummary: "Created full backup archive" } }),
  ]);
  return new Response(Uint8Array.from(payload).buffer, { headers: { "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="${filename}"`, "X-BandOS-SHA256": sha256 } });
}

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) return new Response("Authentication required", { status: 401 });
  if (!hasPermission(user, "EXPORT_DATA")) return new Response("Forbidden", { status: 403 });
  const formData = await request.formData();
  const passphrase = formData.get("passphrase");
  if (typeof passphrase !== "string" || passphrase.length < 12) return new Response("Backup passphrase must be at least 12 characters.", { status: 400 });
  const { archive, program } = await buildArchive();
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(passphrase, salt, 32);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(archive), cipher.final()]);
  const header = Buffer.from(`BANDOSENC1\n${JSON.stringify({ salt: salt.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64") })}\n`);
  const payload = Buffer.concat([header, ciphertext]);
  return recordBackup(payload, `bandos-backup-${new Date().toISOString().slice(0, 10)}.bandos`, program.id, user.username);
}

export async function GET() {
  const user = await requireApiUser();
  if (!user) return new Response("Authentication required", { status: 401 });
  if (!hasPermission(user, "EXPORT_DATA")) return new Response("Forbidden", { status: 403 });
  const { archive, program } = await buildArchive();
  return recordBackup(archive, `bandos-readable-export-${new Date().toISOString().slice(0, 10)}.zip`, program.id, user.username);
}
