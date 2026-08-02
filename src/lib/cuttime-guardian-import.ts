import { randomUUID } from "node:crypto";
import { PersonClassificationType, PersonStatus, type Prisma } from "@/generated/prisma/client";
import type { createPrismaClient } from "@/lib/db";
import type {
  CutTimeGuardianImportInput,
  CutTimeGuardianImportPreview,
  CutTimeMigrationMessage,
  CutTimeMigrationSource,
} from "@/lib/cuttime-migration-types";

type DatabaseClient = ReturnType<typeof createPrismaClient>;
type TransactionClient = Prisma.TransactionClient;

export const CUTTIME_GUARDIAN_SOURCE = "CUTTIME_GUARDIANS";
const CUTTIME_EXTERNAL_SOURCE = "CUTTIME";

export type PlannedCutTimeGuardian = {
  sourceId: string;
  studentSourceId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  relationshipLabel: string | null;
  primaryContact: boolean;
};

export type CutTimeGuardianPlan = {
  guardians: PlannedCutTimeGuardian[];
  errors: CutTimeMigrationMessage[];
  warnings: CutTimeMigrationMessage[];
  mappedFields: string[];
};

function message(code: string, content: string, rowNumber?: number): CutTimeMigrationMessage {
  return { code, message: content, sourceKind: "students", rowNumber };
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function headerKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function rowValues(row: Record<string, string>) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [headerKey(key), text(value)]));
}

function firstValue(row: Record<string, string>, aliases: string[]) {
  const values = rowValues(row);
  for (const alias of aliases) {
    const value = values[headerKey(alias)];
    if (value) return value;
  }
  return "";
}

const GUARDIAN_FIELDS = [
  { label: "Student ID", aliases: ["student id", "member id", "cuttime id"] },
  { label: "Guardian 1", aliases: ["guardian 1 name", "guardian1name"] },
  { label: "Guardian 2", aliases: ["guardian 2 name", "guardian2name"] },
  { label: "Guardian contact details", aliases: ["guardian 1 email", "guardian 1 cell phone", "guardian 2 email", "guardian 2 cell phone"] },
] as const;

export function cutTimeMemberGuardianMappedFields(source: CutTimeMigrationSource) {
  const available = new Set(source.headers.map(headerKey));
  return GUARDIAN_FIELDS.filter((field) => field.aliases.some((alias) => available.has(headerKey(alias)))).map((field) => field.label);
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function guardianSourceId(name: string, email: string, phone: string) {
  const normalizedEmail = email.toLowerCase();
  const normalizedPhone = phone.replace(/\D/g, "");
  const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `member-guardian:${normalizedName}:${normalizedEmail || normalizedPhone}`;
}

export function planCutTimeGuardiansFromMemberExport(source: CutTimeMigrationSource): CutTimeGuardianPlan {
  const errors: CutTimeMigrationMessage[] = [];
  const warnings: CutTimeMigrationMessage[] = [];
  const guardians: PlannedCutTimeGuardian[] = [];
  const plannedLinks = new Set<string>();
  const mappedFields = cutTimeMemberGuardianMappedFields(source);
  if (source.kind !== "students") errors.push(message("INVALID_MEMBER_SOURCE", "Select the CutTime member export for guardian import."));
  if (!source.filename || !source.contentHash || !Array.isArray(source.headers) || !Array.isArray(source.rows)) {
    errors.push(message("INVALID_MEMBER_SOURCE", "The member export could not be read. Remove it and select it again."));
    return { guardians, errors, warnings, mappedFields };
  }
  if (!mappedFields.includes("Student ID") || !mappedFields.includes("Guardian 1")) {
    errors.push(message("GUARDIAN_COLUMNS_REQUIRED", "Use a CutTime member export containing Student ID and Guardian 1 columns."));
    return { guardians, errors, warnings, mappedFields };
  }

  for (const [index, row] of source.rows.entries()) {
    const rowNumber = index + 2;
    const studentSourceId = firstValue(row, ["student id", "member id", "cuttime id"]);
    if (!studentSourceId) {
      errors.push(message("GUARDIAN_STUDENT_ID_REQUIRED", "Every guardian row needs the student's CutTime ID.", rowNumber));
      continue;
    }
    for (const slot of [1, 2]) {
      const fullName = firstValue(row, [`guardian ${slot} name`, `guardian${slot}name`]);
      if (!fullName) continue;
      const email = firstValue(row, [`guardian ${slot} email`, `guardian${slot}email`]);
      const phone = firstValue(row, [`guardian ${slot} cell phone`, `guardian ${slot} phone`, `guardian${slot}cellphone`, `guardian${slot}phone`]);
      if (!email && !phone) {
        warnings.push(message("GUARDIAN_CONTACT_MISSING", `${fullName} has no email address or cell phone and will not be imported.`, rowNumber));
        continue;
      }
      const name = splitName(fullName);
      if (!name) {
        warnings.push(message("GUARDIAN_NAME_INCOMPLETE", `${fullName} does not include both a first and last name and will not be imported.`, rowNumber));
        continue;
      }
      const sourceId = guardianSourceId(fullName, email, phone);
      const linkKey = `${sourceId}:${studentSourceId}`;
      if (plannedLinks.has(linkKey)) {
        warnings.push(message("DUPLICATE_GUARDIAN_LINK", `${fullName} is listed more than once for this student and will be linked once.`, rowNumber));
        continue;
      }
      plannedLinks.add(linkKey);
      guardians.push({
        sourceId,
        studentSourceId,
        firstName: name.firstName,
        lastName: name.lastName,
        email: email || null,
        phone: phone || null,
        relationshipLabel: firstValue(row, [`guardian ${slot} relationship`, `guardian${slot}relationship`]) || null,
        primaryContact: slot === 1,
      });
    }
  }
  return { guardians, errors, warnings, mappedFields };
}

type GuardianImportState = {
  studentIds: Map<string, string>;
  existingGuardianIds: Map<string, string>;
  existingLinks: Set<string>;
};

async function importState(db: DatabaseClient, programId: string, plan: CutTimeGuardianPlan): Promise<GuardianImportState> {
  const studentSourceIds = [...new Set(plan.guardians.map((guardian) => guardian.studentSourceId))];
  const guardianSourceIds = [...new Set(plan.guardians.map((guardian) => guardian.sourceId))];
  const [studentReferences, studentProfiles, guardianReferences, existingGuardians] = await Promise.all([
    db.externalReference.findMany({ where: { programId, source: CUTTIME_EXTERNAL_SOURCE, entityType: "Student", sourceId: { in: studentSourceIds } }, select: { sourceId: true, entityId: true } }),
    db.studentProfile.findMany({ where: { programId, schoolStudentId: { in: studentSourceIds } }, select: { personId: true, schoolStudentId: true } }),
    db.externalReference.findMany({ where: { programId, source: CUTTIME_EXTERNAL_SOURCE, entityType: "Guardian", sourceId: { in: guardianSourceIds } }, select: { sourceId: true, entityId: true } }),
    db.person.findMany({ where: { programId, classifications: { some: { classification: PersonClassificationType.GUARDIAN } } }, select: { id: true, firstName: true, lastName: true, email: true, phone: true } }),
  ]);
  const studentIds = new Map(studentProfiles.flatMap((profile) => profile.schoolStudentId ? [[profile.schoolStudentId, profile.personId] as const] : []));
  for (const reference of studentReferences) studentIds.set(reference.sourceId, reference.entityId);
  const existingGuardianIds = new Map(guardianReferences.map((reference) => [reference.sourceId, reference.entityId]));
  for (const guardian of existingGuardians) {
    const sourceId = guardianSourceId(`${guardian.firstName} ${guardian.lastName}`, guardian.email ?? "", guardian.phone ?? "");
    if (!existingGuardianIds.has(sourceId)) existingGuardianIds.set(sourceId, guardian.id);
  }
  const existingLinks = new Set<string>();
  const guardianIds = [...existingGuardianIds.values()];
  if (guardianIds.length) {
    const links = await db.guardianStudent.findMany({ where: { guardianId: { in: guardianIds } }, select: { guardianId: true, studentId: true } });
    for (const link of links) existingLinks.add(`${link.guardianId}:${link.studentId}`);
  }
  return { studentIds, existingGuardianIds, existingLinks };
}

function previewFromPlan(plan: CutTimeGuardianPlan, source: CutTimeMigrationSource, state: GuardianImportState): CutTimeGuardianImportPreview {
  const errors = [...plan.errors];
  const newGuardianSourceIds = new Set<string>();
  let links = 0;
  for (const guardian of plan.guardians) {
    const studentId = state.studentIds.get(guardian.studentSourceId);
    if (!studentId) {
      errors.push(message("UNKNOWN_GUARDIAN_STUDENT", `Guardian ${guardian.firstName} ${guardian.lastName} references CutTime student ID ${guardian.studentSourceId}, which was not found in Band Office.`));
      continue;
    }
    const guardianId = state.existingGuardianIds.get(guardian.sourceId);
    if (!guardianId) newGuardianSourceIds.add(guardian.sourceId);
    if (!guardianId || !state.existingLinks.has(`${guardianId}:${studentId}`)) links += 1;
  }
  if (!errors.length && links === 0) errors.push(message("NO_GUARDIAN_CHANGES", "All guardian records in this member export are already linked in Band Office."));
  return {
    ready: errors.length === 0,
    errors,
    warnings: plan.warnings,
    counts: { guardians: newGuardianSourceIds.size, links, existingGuardians: state.existingGuardianIds.size },
    source: { filename: source.filename, rowCount: source.rows.length, mappedFields: plan.mappedFields },
  };
}

export async function previewCutTimeGuardianImport(db: DatabaseClient, programId: string, input: CutTimeGuardianImportInput) {
  const plan = planCutTimeGuardiansFromMemberExport(input.source);
  const state = await importState(db, programId, plan);
  return previewFromPlan(plan, input.source, state);
}

async function writeAudit(tx: TransactionClient, programId: string, actor: string, entityType: string, entityId: string, summary: string, fields: string[]) {
  await tx.auditLog.create({ data: { id: randomUUID(), programId, actor, action: "MIGRATE", entityType, entityId, changeSummary: summary, changeDiffJson: JSON.stringify({ fields, values: "[redacted]" }) } });
}

export async function commitCutTimeGuardianImport(db: DatabaseClient, input: { programId: string; actor: string; guardians: CutTimeGuardianImportInput }) {
  const preview = await previewCutTimeGuardianImport(db, input.programId, input.guardians);
  if (!preview.ready) throw new Error(preview.errors[0]?.message ?? "The guardian import is not ready.");
  const plan = planCutTimeGuardiansFromMemberExport(input.guardians.source);
  const state = await importState(db, input.programId, plan);

  return db.$transaction(async (tx) => {
    const runId = randomUUID();
    const run = await tx.migrationRun.create({ data: { id: runId, programId: input.programId, source: CUTTIME_GUARDIAN_SOURCE, actor: input.actor, cutoverAt: new Date(), summaryJson: JSON.stringify({ source: CUTTIME_GUARDIAN_SOURCE, guardians: preview.counts.guardians, links: preview.counts.links, warnings: plan.warnings.length }) } });
    await tx.migrationSource.create({ data: { id: randomUUID(), migrationRunId: run.id, sourceKind: "members_guardians", filename: input.guardians.source.filename, contentHash: input.guardians.source.contentHash, headersJson: JSON.stringify(input.guardians.source.headers), mappingJson: JSON.stringify(plan.mappedFields), rowCount: input.guardians.source.rows.length } });
    const guardianIds = new Map(state.existingGuardianIds);
    for (const guardian of plan.guardians) {
      let guardianId = guardianIds.get(guardian.sourceId);
      if (!guardianId) {
        guardianId = randomUUID();
        await tx.person.create({ data: { id: guardianId, programId: input.programId, firstName: guardian.firstName, lastName: guardian.lastName, email: guardian.email, phone: guardian.phone, status: PersonStatus.ACTIVE } });
        await tx.personClassification.create({ data: { personId: guardianId, classification: PersonClassificationType.GUARDIAN } });
        await tx.externalReference.create({ data: { id: randomUUID(), programId: input.programId, migrationRunId: run.id, source: CUTTIME_EXTERNAL_SOURCE, entityType: "Guardian", sourceId: guardian.sourceId, entityId: guardianId } });
        guardianIds.set(guardian.sourceId, guardianId);
        await writeAudit(tx, input.programId, input.actor, "Person", guardianId, "Created guardian from CutTime member export", ["firstName", "lastName", "email", "phone"]);
      }
      const studentId = state.studentIds.get(guardian.studentSourceId);
      if (!studentId || state.existingLinks.has(`${guardianId}:${studentId}`)) continue;
      const link = await tx.guardianStudent.create({ data: { id: randomUUID(), guardianId, studentId, relationshipLabel: guardian.relationshipLabel, primaryContact: guardian.primaryContact, receivesCommunication: true } });
      await writeAudit(tx, input.programId, input.actor, "GuardianStudent", link.id, "Linked guardian and student from CutTime member export", ["guardianId", "studentId", "relationshipLabel", "primaryContact"]);
    }
    if (plan.warnings.length) await tx.migrationIssue.createMany({ data: plan.warnings.map((warning) => ({ id: randomUUID(), migrationRunId: run.id, code: warning.code, sourceKind: "students", rowNumber: warning.rowNumber ?? null, message: warning.message })) });
    await writeAudit(tx, input.programId, input.actor, "MigrationRun", run.id, "Completed CutTime guardian import", ["source", "guardians", "links", "warnings"]);
    return { runId: run.id, preview };
  });
}
