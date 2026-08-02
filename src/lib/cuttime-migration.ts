import { randomUUID } from "node:crypto";
import {
  AssetCategory,
  AssetCondition,
  AssetStatus,
  ComponentStatus,
  FinancialEntryType,
  GroupKind,
  PersonClassificationType,
  PersonStatus,
  RepairStatus,
  type Prisma,
} from "@/generated/prisma/client";
import type { createPrismaClient } from "@/lib/db";
import {
  CUTTIME_SOURCE_KINDS,
  type CutTimeMigrationInput,
  type CutTimeMigrationMessage,
  type CutTimeMigrationPreview,
  type CutTimeMigrationSource,
  type CutTimeSourceKind,
} from "@/lib/cuttime-migration-types";

type DatabaseClient = ReturnType<typeof createPrismaClient>;
type TransactionClient = Prisma.TransactionClient;

const MAX_ROWS_PER_SOURCE = 5_000;
const MAX_CELL_LENGTH = 2_000;
const CUTTIME_SOURCE = "CUTTIME";

type PlannedStudent = {
  sourceId: string;
  firstName: string;
  lastName: string;
  grade: number;
  schoolStudentId: string;
  section: string | null;
  groups: string[];
  email: string | null;
  phone: string | null;
};

type PlannedGuardian = {
  sourceId: string;
  studentSourceId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  relationshipLabel: string | null;
  primaryContact: boolean;
};

type PlannedGroupMembership = { groupName: string; studentSourceId: string; roleLabel: string | null };

type PlannedAsset = {
  sourceId: string;
  category: AssetCategory;
  schoolAssetTag: string;
  make: string | null;
  model: string | null;
  serialNumber: string | null;
  size: string | null;
  condition: AssetCondition;
  status: AssetStatus;
  purchaseYear: number | null;
  estimatedValue: number | null;
  location: string | null;
  notes: string | null;
  components: Array<{ name: string; status: ComponentStatus }>;
  assignedStudentSourceId: string | null;
  repairDescription: string | null;
};

type PlannedBalance = { studentSourceId: string; amount: number };

type MigrationPlan = {
  cutoverAt: Date;
  students: PlannedStudent[];
  guardians: PlannedGuardian[];
  memberships: PlannedGroupMembership[];
  assets: PlannedAsset[];
  balances: PlannedBalance[];
  errors: CutTimeMigrationMessage[];
  warnings: CutTimeMigrationMessage[];
  sources: CutTimeMigrationPreview["sources"];
};

export class CutTimeMigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CutTimeMigrationError";
  }
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

function sourceFields(source: CutTimeMigrationSource, fields: Array<{ label: string; aliases: string[] }>) {
  const available = new Set(source.headers.map(headerKey));
  return fields.filter((field) => field.aliases.some((alias) => available.has(headerKey(alias)))).map((field) => field.label);
}

function message(code: string, content: string, sourceKind?: CutTimeSourceKind, rowNumber?: number): CutTimeMigrationMessage {
  return { code, message: content, sourceKind, rowNumber };
}

function splitValues(value: string) {
  return [...new Set(value.split(/[;,|]/).map((item) => item.trim()).filter(Boolean))];
}

function parseBoolean(value: string) {
  return ["true", "yes", "y", "1", "primary"].includes(value.trim().toLowerCase());
}

function parseGrade(value: string) {
  const match = value.trim().match(/\d{1,2}/);
  const grade = match ? Number(match[0]) : Number.NaN;
  return Number.isInteger(grade) && grade >= 1 && grade <= 12 ? grade : null;
}

function parseMoney(value: string) {
  const normalized = value.trim().replaceAll("$", "").replaceAll(",", "").replace(/^\((.*)\)$/, "-$1");
  if (!normalized) return 0;
  const amount = Number(normalized);
  return Number.isFinite(amount) && Math.round(amount * 100) === amount * 100 ? amount : null;
}

function parseOptionalMoney(value: string) {
  return value.trim() ? parseMoney(value) : null;
}

function parseYear(value: string) {
  const year = Number(value.trim());
  return Number.isInteger(year) && year >= 1900 && year <= 2100 ? year : null;
}

function parseCondition(value: string) {
  const normalized = value.trim().toUpperCase().replaceAll(" ", "_");
  return Object.values(AssetCondition).includes(normalized as AssetCondition) ? normalized as AssetCondition : null;
}

function parseAssetStatus(value: string) {
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (["RETIRED", "MISSING", "IN_REPAIR", "ASSIGNED", "AVAILABLE"].includes(normalized)) return normalized as AssetStatus;
  return AssetStatus.AVAILABLE;
}

function validateInput(input: CutTimeMigrationInput, errors: CutTimeMigrationMessage[]) {
  if (!input || typeof input !== "object" || !Array.isArray(input.sources)) {
    errors.push(message("INVALID_PAYLOAD", "The migration data is incomplete. Reload the page and add the exported files again."));
    return;
  }
  if (!input.cutoverDate || Number.isNaN(new Date(`${input.cutoverDate}T12:00:00`).getTime())) errors.push(message("INVALID_CUTOVER_DATE", "Choose the date on which CutTime became read-only for this migration."));
  const seen = new Set<string>();
  for (const source of input.sources) {
    if (!CUTTIME_SOURCE_KINDS.includes(source.kind)) errors.push(message("UNKNOWN_SOURCE", "One selected file has an unsupported migration role."));
    if (seen.has(source.kind)) errors.push(message("DUPLICATE_SOURCE", `Only one ${source.kind} export can be included in this migration.`, source.kind));
    seen.add(source.kind);
    if (!source.filename || !source.contentHash || !Array.isArray(source.headers) || !Array.isArray(source.rows)) {
      errors.push(message("INVALID_SOURCE", "One selected file could not be read. Remove it and select it again.", source.kind));
      continue;
    }
    if (source.rows.length > MAX_ROWS_PER_SOURCE) errors.push(message("SOURCE_TOO_LARGE", `${source.filename} has more than ${MAX_ROWS_PER_SOURCE.toLocaleString()} rows. Split the export before migrating.`, source.kind));
    if (source.rows.some((row) => Object.values(row).some((value) => String(value).length > MAX_CELL_LENGTH))) errors.push(message("CELL_TOO_LARGE", `${source.filename} contains a value longer than ${MAX_CELL_LENGTH.toLocaleString()} characters.`, source.kind));
  }
}

function sourceFor(input: CutTimeMigrationInput, kind: CutTimeSourceKind) {
  return input.sources.find((source) => source.kind === kind);
}

function planMigration(input: CutTimeMigrationInput): MigrationPlan {
  const errors: CutTimeMigrationMessage[] = [];
  const warnings: CutTimeMigrationMessage[] = [];
  validateInput(input, errors);
  const cutoverAt = new Date(`${input.cutoverDate}T12:00:00`);
  const students: PlannedStudent[] = [];
  const guardians: PlannedGuardian[] = [];
  const memberships: PlannedGroupMembership[] = [];
  const assets: PlannedAsset[] = [];
  const balances: PlannedBalance[] = [];
  const sources: CutTimeMigrationPreview["sources"] = [];

  for (const source of input.sources ?? []) {
    const fields = source.kind === "students"
      ? [{ label: "Student ID", aliases: ["student id", "member id", "cuttime id"] }, { label: "First name", aliases: ["first name", "firstname"] }, { label: "Last name", aliases: ["last name", "lastname"] }, { label: "Grade", aliases: ["grade"] }, { label: "Primary position", aliases: ["primary position", "position", "instrument", "section"] }, { label: "Groups", aliases: ["groups", "group"] }]
      : source.kind === "guardians"
        ? [{ label: "Student ID", aliases: ["student id", "member id", "cuttime student id"] }, { label: "Guardian ID", aliases: ["guardian id", "contact id"] }, { label: "First name", aliases: ["first name", "guardian first name"] }, { label: "Last name", aliases: ["last name", "guardian last name"] }, { label: "Email", aliases: ["email", "guardian email"] }, { label: "Phone", aliases: ["phone", "guardian phone", "mobile"] }]
        : source.kind === "groups"
          ? [{ label: "Group", aliases: ["group", "group name", "name"] }, { label: "Student ID", aliases: ["student id", "member id"] }, { label: "Position", aliases: ["position", "role"] }]
          : source.kind === "balances"
            ? [{ label: "Student ID", aliases: ["student id", "member id", "cuttime student id"] }, { label: "Balance", aliases: ["balance", "student balance", "amount due", "total due"] }]
          : [{ label: "Asset ID", aliases: ["instrument id", "attire id", "equipment id", "asset id", "inventory id", "id"] }, { label: "Asset tag", aliases: ["asset tag", "school asset tag", "inventory number", "tag"] }, { label: "Current student ID", aliases: ["assigned student id", "student id", "member id"] }, { label: "Condition", aliases: ["condition"] }];
    sources.push({ kind: source.kind, filename: source.filename, rowCount: source.rows.length, mappedFields: sourceFields(source, fields) });
  }

  const studentSource = sourceFor(input, "students");
  if (!studentSource) {
    errors.push(message("STUDENTS_REQUIRED", "Add the CutTime member export before continuing."));
  } else {
    const seenStudentIds = new Set<string>();
    for (const [index, sourceRow] of studentSource.rows.entries()) {
      const row = sourceRow;
      const sourceId = firstValue(row, ["student id", "member id", "cuttime id"]);
      const firstName = firstValue(row, ["first name", "firstname"]);
      const lastName = firstValue(row, ["last name", "lastname"]);
      const grade = parseGrade(firstValue(row, ["grade"]));
      if (!sourceId || !firstName || !lastName || grade === null) {
        errors.push(message("STUDENT_REQUIRED_FIELD", "Student ID, first name, last name, and grade are required for every member.", "students", index + 2));
        continue;
      }
      if (seenStudentIds.has(sourceId)) {
        errors.push(message("DUPLICATE_STUDENT_ID", `Student ID ${sourceId} appears more than once.`, "students", index + 2));
        continue;
      }
      seenStudentIds.add(sourceId);
      const section = firstValue(row, ["primary position", "position", "instrument", "section"]) || null;
      students.push({
        sourceId,
        firstName,
        lastName,
        grade,
        schoolStudentId: firstValue(row, ["school student id", "school id", "sis id"]) || sourceId,
        section,
        groups: splitValues(firstValue(row, ["groups", "group"])),
        email: firstValue(row, ["email", "student email"]) || null,
        phone: firstValue(row, ["phone", "student phone", "mobile"]) || null,
      });
    }
  }

  const guardianSource = sourceFor(input, "guardians");
  if (guardianSource) {
    for (const [index, row] of guardianSource.rows.entries()) {
      const studentSourceId = firstValue(row, ["student id", "member id", "cuttime student id"]);
      const firstName = firstValue(row, ["guardian first name", "first name", "firstname"]);
      const lastName = firstValue(row, ["guardian last name", "last name", "lastname"]);
      const email = firstValue(row, ["guardian email", "email"]);
      const phone = firstValue(row, ["guardian phone", "phone", "mobile"]);
      if (!studentSourceId || !firstName || !lastName || (!email && !phone)) {
        errors.push(message("GUARDIAN_REQUIRED_FIELD", "Every guardian needs a linked student ID, name, and either an email address or phone number.", "guardians", index + 2));
        continue;
      }
      const sourceId = firstValue(row, ["guardian id", "contact id"]) || `${email.toLowerCase()}|${phone.replace(/\D/g, "")}`;
      guardians.push({ sourceId, studentSourceId, firstName, lastName, email: email || null, phone: phone || null, relationshipLabel: firstValue(row, ["relationship", "relationship type"]) || null, primaryContact: parseBoolean(firstValue(row, ["primary", "primary contact"])), });
    }
  }

  const groupSource = sourceFor(input, "groups");
  if (groupSource) {
    for (const [index, row] of groupSource.rows.entries()) {
      const groupName = firstValue(row, ["group name", "group", "name"]);
      const studentSourceId = firstValue(row, ["student id", "member id"]);
      if (!groupName) {
        errors.push(message("GROUP_NAME_REQUIRED", "Each group row needs a group name.", "groups", index + 2));
        continue;
      }
      if (studentSourceId) memberships.push({ groupName, studentSourceId, roleLabel: firstValue(row, ["position", "role"]) || null });
    }
  }

  for (const kind of ["instruments", "attire", "equipment"] as const) {
    const source = sourceFor(input, kind);
    if (!source) continue;
    const category = kind === "instruments" ? AssetCategory.INSTRUMENT : kind === "attire" ? AssetCategory.UNIFORM : AssetCategory.EQUIPMENT;
    for (const [index, row] of source.rows.entries()) {
      const sourceId = firstValue(row, [kind === "instruments" ? "instrument id" : kind === "attire" ? "attire id" : "equipment id", "asset id", "inventory id", "id"]);
      const schoolAssetTag = firstValue(row, ["asset tag", "school asset tag", "inventory number", "tag"]);
      if (!sourceId || !schoolAssetTag) {
        errors.push(message("ASSET_REQUIRED_FIELD", "Each asset needs its CutTime identifier and an asset tag.", kind, index + 2));
        continue;
      }
      const parsedCondition = parseCondition(firstValue(row, ["condition"]));
      if (!parsedCondition && firstValue(row, ["condition"])) warnings.push(message("UNKNOWN_CONDITION", `${schoolAssetTag} has an unrecognized condition and will be set to Good.`, kind, index + 2));
      const status = parseAssetStatus(firstValue(row, ["status"]));
      const componentNames = splitValues(firstValue(row, ["components", "component list"]));
      const missingComponents = splitValues(firstValue(row, ["missing parts", "missing components"]));
      let assignedStudentSourceId = firstValue(row, ["assigned student id", "assigned member id"]) || null;
      if (firstValue(row, ["assigned to", "current assignee"]) && !assignedStudentSourceId) warnings.push(message("UNLINKED_ASSIGNMENT", `${schoolAssetTag} names a current holder without a student ID. It will import unassigned for director review.`, kind, index + 2));
      if (status === AssetStatus.IN_REPAIR && assignedStudentSourceId) {
        warnings.push(message("REPAIR_ASSIGNMENT_CONFLICT", `${schoolAssetTag} is marked In Repair and assigned to a student. It will import as an open repair without a current assignment.`, kind, index + 2));
        assignedStudentSourceId = null;
      }
      assets.push({
        sourceId,
        category,
        schoolAssetTag,
        make: firstValue(row, ["make", "manufacturer"]) || null,
        model: firstValue(row, ["model"]) || null,
        serialNumber: firstValue(row, ["serial number", "serial"]) || null,
        size: firstValue(row, ["size"]) || null,
        condition: parsedCondition ?? AssetCondition.GOOD,
        status,
        purchaseYear: parseYear(firstValue(row, ["purchase year", "year"])),
        estimatedValue: parseOptionalMoney(firstValue(row, ["estimated value", "value", "purchase price"])),
        location: firstValue(row, ["location", "storage location"]) || null,
        notes: firstValue(row, ["comments", "notes"]) || null,
        components: [...componentNames.map((name) => ({ name, status: ComponentStatus.PRESENT })), ...missingComponents.filter((name) => !componentNames.includes(name)).map((name) => ({ name, status: ComponentStatus.MISSING }))],
        assignedStudentSourceId,
        repairDescription: firstValue(row, ["repair description", "repair notes"]) || null,
      });
    }
  }

  const balanceSource = sourceFor(input, "balances");
  if (balanceSource) {
    const seenBalanceStudents = new Set<string>();
    for (const [index, row] of balanceSource.rows.entries()) {
      const studentSourceId = firstValue(row, ["student id", "member id", "cuttime student id"]);
      const amount = parseMoney(firstValue(row, ["student balance", "balance", "amount due", "total due"]));
      if (!studentSourceId || amount === null) {
        errors.push(message("BALANCE_REQUIRED_FIELD", "Each balance row needs a student ID and a valid balance.", "balances", index + 2));
        continue;
      }
      if (seenBalanceStudents.has(studentSourceId)) {
        errors.push(message("DUPLICATE_BALANCE", `Student ID ${studentSourceId} has more than one opening balance row.`, "balances", index + 2));
        continue;
      }
      seenBalanceStudents.add(studentSourceId);
      if (amount !== 0) balances.push({ studentSourceId, amount });
    }
  }

  const studentIds = new Set(students.map((student) => student.sourceId));
  for (const guardian of guardians) if (!studentIds.has(guardian.studentSourceId)) errors.push(message("UNKNOWN_GUARDIAN_STUDENT", `Guardian ${guardian.firstName} ${guardian.lastName} references student ID ${guardian.studentSourceId}, which was not found in the member export.`, "guardians"));
  for (const membership of memberships) if (!studentIds.has(membership.studentSourceId)) errors.push(message("UNKNOWN_GROUP_STUDENT", `Group ${membership.groupName} references student ID ${membership.studentSourceId}, which was not found in the member export.`, "groups"));
  for (const balance of balances) if (!studentIds.has(balance.studentSourceId)) errors.push(message("UNKNOWN_BALANCE_STUDENT", `Opening balance references student ID ${balance.studentSourceId}, which was not found in the member export.`, "balances"));

  const sourceIds = new Set<string>();
  const assetTags = new Set<string>();
  for (const asset of assets) {
    const unique = `${asset.category}:${asset.sourceId}`;
    if (sourceIds.has(unique)) errors.push(message("DUPLICATE_ASSET_ID", `Asset identifier ${asset.sourceId} appears more than once in ${asset.category.toLowerCase()} exports.`));
    sourceIds.add(unique);
    const tag = asset.schoolAssetTag.toLowerCase();
    if (assetTags.has(tag)) errors.push(message("DUPLICATE_ASSET_TAG", `Asset tag ${asset.schoolAssetTag} appears more than once. Asset tags must be unique in Band Office.`));
    assetTags.add(tag);
    if (asset.assignedStudentSourceId && !studentIds.has(asset.assignedStudentSourceId)) errors.push(message("UNKNOWN_ASSET_STUDENT", `${asset.schoolAssetTag} references student ID ${asset.assignedStudentSourceId}, which was not found in the member export.`));
  }

  return { cutoverAt, students, guardians, memberships, assets, balances, errors, warnings, sources };
}

async function assertEmptyDestination(db: DatabaseClient, programId: string) {
  const [students, guardians, groups, assets, assignments, financialEntries, priorRuns] = await Promise.all([
    db.studentProfile.count({ where: { programId } }),
    db.personClassification.count({ where: { classification: PersonClassificationType.GUARDIAN, person: { programId } } }),
    db.group.count({ where: { programId } }),
    db.asset.count({ where: { programId } }),
    db.assignment.count({ where: { asset: { programId } } }),
    db.financialEntry.count({ where: { programId } }),
    db.migrationRun.count({ where: { programId, source: CUTTIME_SOURCE } }),
  ]);
  if (students || guardians || groups || assets || assignments || financialEntries || priorRuns) throw new CutTimeMigrationError("Migrate from CutTime is available only for a new, empty Band Office program. Use the regular spreadsheet importer for later updates.");
}

function previewFromPlan(plan: MigrationPlan): CutTimeMigrationPreview {
  const groupNames = new Set<string>();
  for (const student of plan.students) {
    if (student.section) groupNames.add(student.section.trim().toLowerCase());
    for (const group of student.groups) groupNames.add(group.trim().toLowerCase());
  }
  for (const membership of plan.memberships) groupNames.add(membership.groupName.trim().toLowerCase());
  return {
    ready: plan.errors.length === 0,
    errors: plan.errors,
    warnings: plan.warnings,
    counts: { students: plan.students.length, guardians: new Set(plan.guardians.map((guardian) => guardian.sourceId)).size, groups: groupNames.size, assets: plan.assets.length, assignments: plan.assets.filter((asset) => Boolean(asset.assignedStudentSourceId)).length, openingBalances: plan.balances.length },
    sources: plan.sources,
  };
}

export async function previewCutTimeMigration(db: DatabaseClient, programId: string, input: CutTimeMigrationInput) {
  const plan = planMigration(input);
  try {
    await assertEmptyDestination(db, programId);
  } catch (error) {
    plan.errors.push(message("DESTINATION_NOT_EMPTY", error instanceof Error ? error.message : "The destination program is not empty."));
  }
  return previewFromPlan(plan);
}

async function writeAudit(tx: TransactionClient, programId: string, actor: string, entityType: string, entityId: string, summary: string, fields: string[]) {
  await tx.auditLog.create({ data: { id: randomUUID(), programId, actor, action: "MIGRATE", entityType, entityId, changeSummary: summary, changeDiffJson: JSON.stringify({ fields, values: "[redacted]" }) } });
}

export async function commitCutTimeMigration(db: DatabaseClient, input: { programId: string; operatingPeriodId: string; actor: string; migration: CutTimeMigrationInput }) {
  await assertEmptyDestination(db, input.programId);
  const plan = planMigration(input.migration);
  if (plan.errors.length) throw new CutTimeMigrationError(plan.errors[0].message);

  return db.$transaction(async (tx) => {
    const runId = randomUUID();
    const run = await tx.migrationRun.create({
      data: {
        id: runId,
        programId: input.programId,
        source: CUTTIME_SOURCE,
        actor: input.actor,
        cutoverAt: plan.cutoverAt,
        summaryJson: JSON.stringify({ source: CUTTIME_SOURCE, cutoverAt: plan.cutoverAt.toISOString(), students: plan.students.length, guardians: new Set(plan.guardians.map((guardian) => guardian.sourceId)).size, assets: plan.assets.length, balances: plan.balances.length, warnings: plan.warnings.length }),
      },
    });
    await tx.migrationSource.createMany({ data: input.migration.sources.map((source) => ({ id: randomUUID(), migrationRunId: run.id, sourceKind: source.kind, filename: source.filename, contentHash: source.contentHash, headersJson: JSON.stringify(source.headers), mappingJson: JSON.stringify(plan.sources.find((entry) => entry.kind === source.kind)?.mappedFields ?? []), rowCount: source.rows.length })) });

    const groups = new Map<string, string>();
    const students = new Map<string, { personId: string; sectionGroupId: string | null }>();
    const guardianPeople = new Map<string, string>();

    async function ensureGroup(name: string, kind: GroupKind) {
      const cleaned = name.trim();
      const key = cleaned.toLowerCase();
      if (!cleaned) return null;
      const known = groups.get(key);
      if (known) return known;
      const group = await tx.group.create({ data: { id: randomUUID(), programId: input.programId, name: cleaned, kind } });
      groups.set(key, group.id);
      await writeAudit(tx, input.programId, input.actor, "Group", group.id, "Created group from CutTime migration", ["name", "kind"]);
      return group.id;
    }

    for (const student of plan.students) {
      const personId = randomUUID();
      await tx.person.create({ data: { id: personId, programId: input.programId, firstName: student.firstName, lastName: student.lastName, email: student.email, phone: student.phone, status: PersonStatus.ACTIVE } });
      await tx.studentProfile.create({ data: { personId, programId: input.programId, grade: student.grade, schoolStudentId: student.schoolStudentId } });
      await tx.personClassification.create({ data: { personId, classification: PersonClassificationType.STUDENT } });
      await tx.externalReference.create({ data: { id: randomUUID(), programId: input.programId, migrationRunId: run.id, source: CUTTIME_SOURCE, entityType: "Student", sourceId: student.sourceId, entityId: personId } });
      const sectionGroupId = student.section ? await ensureGroup(student.section, GroupKind.SECTION) : null;
      if (sectionGroupId) {
        const membership = await tx.groupMembership.create({ data: { id: randomUUID(), groupId: sectionGroupId, personId } });
        await writeAudit(tx, input.programId, input.actor, "GroupMembership", membership.id, "Added student to section from CutTime migration", ["groupId", "personId"]);
      }
      for (const groupName of student.groups) {
        const groupId = await ensureGroup(groupName, GroupKind.CUSTOM);
        if (groupId && groupId !== sectionGroupId) {
          const membership = await tx.groupMembership.create({ data: { id: randomUUID(), groupId, personId } });
          await writeAudit(tx, input.programId, input.actor, "GroupMembership", membership.id, "Added student to group from CutTime migration", ["groupId", "personId"]);
        }
      }
      students.set(student.sourceId, { personId, sectionGroupId });
      await writeAudit(tx, input.programId, input.actor, "Person", personId, "Created student from CutTime migration", ["firstName", "lastName", "grade", "schoolStudentId", "email", "phone"]);
    }

    for (const membership of plan.memberships) {
      const student = students.get(membership.studentSourceId);
      const groupId = await ensureGroup(membership.groupName, GroupKind.CUSTOM);
      if (!student || !groupId) continue;
      const link = await tx.groupMembership.upsert({ where: { groupId_personId: { groupId, personId: student.personId } }, update: { endedAt: null, roleLabel: membership.roleLabel }, create: { id: randomUUID(), groupId, personId: student.personId, roleLabel: membership.roleLabel } });
      await writeAudit(tx, input.programId, input.actor, "GroupMembership", link.id, "Reconciled group membership from CutTime migration", ["groupId", "personId", "roleLabel"]);
    }

    for (const guardian of plan.guardians) {
      const student = students.get(guardian.studentSourceId);
      if (!student) continue;
      let guardianId = guardianPeople.get(guardian.sourceId);
      if (!guardianId) {
        guardianId = randomUUID();
        await tx.person.create({ data: { id: guardianId, programId: input.programId, firstName: guardian.firstName, lastName: guardian.lastName, email: guardian.email, phone: guardian.phone, status: PersonStatus.ACTIVE } });
        await tx.personClassification.create({ data: { personId: guardianId, classification: PersonClassificationType.GUARDIAN } });
        await tx.externalReference.create({ data: { id: randomUUID(), programId: input.programId, migrationRunId: run.id, source: CUTTIME_SOURCE, entityType: "Guardian", sourceId: guardian.sourceId, entityId: guardianId } });
        guardianPeople.set(guardian.sourceId, guardianId);
        await writeAudit(tx, input.programId, input.actor, "Person", guardianId, "Created guardian from CutTime migration", ["firstName", "lastName", "email", "phone"]);
      }
      const link = await tx.guardianStudent.create({ data: { id: randomUUID(), guardianId, studentId: student.personId, relationshipLabel: guardian.relationshipLabel, primaryContact: guardian.primaryContact, receivesCommunication: true } });
      await writeAudit(tx, input.programId, input.actor, "GuardianStudent", link.id, "Linked guardian and student from CutTime migration", ["guardianId", "studentId", "relationshipLabel", "primaryContact"]);
    }

    for (const asset of plan.assets) {
      const assetId = randomUUID();
      const initialStatus = asset.status === AssetStatus.RETIRED || asset.status === AssetStatus.MISSING ? asset.status : AssetStatus.AVAILABLE;
      await tx.asset.create({ data: { id: assetId, programId: input.programId, category: asset.category, schoolAssetTag: asset.schoolAssetTag, make: asset.make, model: asset.model, serialNumber: asset.serialNumber, size: asset.size, condition: asset.condition, status: initialStatus, purchaseYear: asset.purchaseYear, estimatedValue: asset.estimatedValue, location: asset.location, notes: asset.notes } });
      await tx.externalReference.create({ data: { id: randomUUID(), programId: input.programId, migrationRunId: run.id, source: CUTTIME_SOURCE, entityType: "Asset", sourceId: `${asset.category}:${asset.sourceId}`, entityId: assetId } });
      for (const component of asset.components) {
        const componentId = randomUUID();
        await tx.assetComponent.create({ data: { id: componentId, assetId, name: component.name, status: component.status } });
        await writeAudit(tx, input.programId, input.actor, "AssetComponent", componentId, "Created asset component from CutTime migration", ["name", "status"]);
      }
      if (asset.assignedStudentSourceId) {
        const student = students.get(asset.assignedStudentSourceId);
        if (student) {
          const assignment = await tx.assignment.create({ data: { id: randomUUID(), assetId, personId: student.personId, groupId: student.sectionGroupId, operatingPeriodId: input.operatingPeriodId, checkedOutAt: plan.cutoverAt, conditionOut: asset.condition, agreementOnFile: false } });
          await tx.asset.update({ where: { id: assetId }, data: { status: AssetStatus.ASSIGNED } });
          await writeAudit(tx, input.programId, input.actor, "Assignment", assignment.id, "Recorded current assignment from CutTime migration", ["assetId", "personId", "operatingPeriodId", "checkedOutAt", "conditionOut"]);
        }
      } else if (asset.status === AssetStatus.IN_REPAIR) {
        const repair = await tx.repair.create({ data: { id: randomUUID(), assetId, operatingPeriodId: input.operatingPeriodId, openedAt: plan.cutoverAt, description: asset.repairDescription || "Imported as open repair from CutTime", status: RepairStatus.OPEN } });
        await tx.asset.update({ where: { id: assetId }, data: { status: AssetStatus.IN_REPAIR } });
        await writeAudit(tx, input.programId, input.actor, "Repair", repair.id, "Created open repair from CutTime migration", ["assetId", "openedAt", "description", "status"]);
      }
      await writeAudit(tx, input.programId, input.actor, "Asset", assetId, "Created asset from CutTime migration", ["category", "schoolAssetTag", "make", "model", "serialNumber", "size", "condition", "status", "purchaseYear", "estimatedValue", "location", "notes"]);
    }

    for (const balance of plan.balances) {
      const student = students.get(balance.studentSourceId);
      if (!student) continue;
      const type = balance.amount > 0 ? FinancialEntryType.CHARGE : FinancialEntryType.CREDIT;
      const entry = await tx.financialEntry.create({ data: { id: randomUUID(), programId: input.programId, personId: student.personId, operatingPeriodId: input.operatingPeriodId, type, amount: balance.amount, occurredAt: plan.cutoverAt, description: `Imported CutTime opening balance as of ${input.migration.cutoverDate}`, reference: CUTTIME_SOURCE, createdBy: input.actor } });
      await writeAudit(tx, input.programId, input.actor, "FinancialEntry", entry.id, "Posted opening balance from CutTime migration", ["personId", "operatingPeriodId", "type", "amount", "occurredAt", "description", "reference"]);
    }

    if (plan.warnings.length) await tx.migrationIssue.createMany({ data: plan.warnings.map((warning) => ({ id: randomUUID(), migrationRunId: run.id, code: warning.code, sourceKind: warning.sourceKind ?? null, rowNumber: warning.rowNumber ?? null, message: warning.message })) });
    await writeAudit(tx, input.programId, input.actor, "MigrationRun", run.id, "Completed CutTime migration", ["source", "cutoverAt", "summary"]);
    return { runId: run.id, preview: previewFromPlan(plan) };
  });
}
