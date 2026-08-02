import { randomUUID } from "node:crypto";
import { FinancialEntryType, type Prisma } from "@/generated/prisma/client";
import type { createPrismaClient } from "@/lib/db";
import type {
  CutTimeBalanceImportInput,
  CutTimeBalanceImportPreview,
  CutTimeMigrationMessage,
  CutTimeMigrationSource,
} from "@/lib/cuttime-migration-types";

type DatabaseClient = ReturnType<typeof createPrismaClient>;
type TransactionClient = Prisma.TransactionClient;

export const CUTTIME_BALANCES_SOURCE = "CUTTIME_BALANCES";
const CUTTIME_EXTERNAL_SOURCE = "CUTTIME";
const MAX_ROWS = 5_000;
const MAX_CELL_LENGTH = 2_000;

type PlannedCutTimeBalance = {
  studentSourceId: string;
  amount: number;
};

type CutTimeBalancePlan = {
  cutoverAt: Date | null;
  balances: PlannedCutTimeBalance[];
  zeroBalances: number;
  errors: CutTimeMigrationMessage[];
  warnings: CutTimeMigrationMessage[];
  mappedFields: string[];
};

function message(code: string, content: string, rowNumber?: number): CutTimeMigrationMessage {
  return { code, message: content, sourceKind: "balances", rowNumber };
}

function headerKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function rowValues(row: Record<string, string>) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [headerKey(key), value.trim()]));
}

function firstValue(row: Record<string, string>, aliases: string[]) {
  const values = rowValues(row);
  for (const alias of aliases) {
    const value = values[headerKey(alias)];
    if (value) return value;
  }
  return "";
}

const BALANCE_FIELDS = [
  { label: "Student ID", aliases: ["student id", "member id", "cuttime student id"] },
  { label: "Balance", aliases: ["student balance", "balance", "amount due", "total due"] },
] as const;

export function cutTimeBalanceMappedFields(source: CutTimeMigrationSource) {
  const available = new Set(source.headers.map(headerKey));
  return BALANCE_FIELDS.filter((field) => field.aliases.some((alias) => available.has(headerKey(alias)))).map((field) => field.label);
}

function parseMoney(value: string) {
  const normalized = value.trim().replaceAll("$", "").replaceAll(",", "").replace(/^\((.*)\)$/, "-$1");
  if (!normalized) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) && Math.round(amount * 100) === amount * 100 ? amount : null;
}

function parseCutoverDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}

function planCutTimeBalanceImport(input: CutTimeBalanceImportInput): CutTimeBalancePlan {
  const errors: CutTimeMigrationMessage[] = [];
  const warnings: CutTimeMigrationMessage[] = [];
  const balances: PlannedCutTimeBalance[] = [];
  const mappedFields = cutTimeBalanceMappedFields(input.source);
  const cutoverAt = parseCutoverDate(input.cutoverDate);

  if (!cutoverAt) errors.push(message("CUTOVER_DATE_REQUIRED", "Choose the date the CutTime balance export represents."));
  if (input.source.kind !== "balances") errors.push(message("INVALID_BALANCE_SOURCE", "Select the CutTime student-balance export."));
  if (!input.source.filename || !input.source.contentHash || !Array.isArray(input.source.headers) || !Array.isArray(input.source.rows)) {
    errors.push(message("INVALID_BALANCE_SOURCE", "The balance export could not be read. Remove it and select it again."));
    return { cutoverAt, balances, zeroBalances: 0, errors, warnings, mappedFields };
  }
  if (!mappedFields.includes("Student ID") || !mappedFields.includes("Balance")) {
    errors.push(message("BALANCE_COLUMNS_REQUIRED", "Use a CutTime balance export containing Student ID and Student balance columns."));
    return { cutoverAt, balances, zeroBalances: 0, errors, warnings, mappedFields };
  }
  if (input.source.rows.length > MAX_ROWS) errors.push(message("BALANCE_SOURCE_TOO_LARGE", `${input.source.filename} has more than ${MAX_ROWS.toLocaleString()} rows. Split the export before importing.`));
  if (input.source.rows.some((row) => Object.values(row).some((value) => value.length > MAX_CELL_LENGTH))) errors.push(message("BALANCE_CELL_TOO_LARGE", `${input.source.filename} contains a value longer than ${MAX_CELL_LENGTH.toLocaleString()} characters.`));

  const seenStudents = new Set<string>();
  let zeroBalances = 0;
  for (const [index, row] of input.source.rows.entries()) {
    const rowNumber = index + 2;
    const studentSourceId = firstValue(row, ["student id", "member id", "cuttime student id"]);
    const amount = parseMoney(firstValue(row, ["student balance", "balance", "amount due", "total due"]));
    if (!studentSourceId || amount === null) {
      errors.push(message("BALANCE_REQUIRED_FIELD", "Each balance row needs a student ID and a valid balance.", rowNumber));
      continue;
    }
    if (seenStudents.has(studentSourceId)) {
      errors.push(message("DUPLICATE_BALANCE", `Student ID ${studentSourceId} has more than one balance row.`, rowNumber));
      continue;
    }
    seenStudents.add(studentSourceId);
    if (amount === 0) {
      zeroBalances += 1;
      continue;
    }
    balances.push({ studentSourceId, amount });
  }
  if (!errors.length && balances.length === 0) errors.push(message("NO_OPENING_BALANCES", "The export contains no nonzero balances to import."));
  return { cutoverAt, balances, zeroBalances, errors, warnings, mappedFields };
}

type BalanceImportState = {
  studentIds: Map<string, string>;
  priorImport: boolean;
};

async function importState(db: DatabaseClient, programId: string, plan: CutTimeBalancePlan): Promise<BalanceImportState> {
  const sourceIds = [...new Set(plan.balances.map((balance) => balance.studentSourceId))];
  const [studentReferences, studentProfiles, priorImport] = await Promise.all([
    db.externalReference.findMany({ where: { programId, source: CUTTIME_EXTERNAL_SOURCE, entityType: "Student", sourceId: { in: sourceIds } }, select: { sourceId: true, entityId: true } }),
    db.studentProfile.findMany({ where: { programId, schoolStudentId: { in: sourceIds } }, select: { personId: true, schoolStudentId: true } }),
    db.migrationRun.findFirst({ where: { programId, OR: [{ source: CUTTIME_BALANCES_SOURCE }, { source: CUTTIME_EXTERNAL_SOURCE, sources: { some: { sourceKind: "balances" } } }] }, select: { id: true } }),
  ]);
  const studentIds = new Map(studentProfiles.flatMap((profile) => profile.schoolStudentId ? [[profile.schoolStudentId, profile.personId] as const] : []));
  for (const reference of studentReferences) studentIds.set(reference.sourceId, reference.entityId);
  return { studentIds, priorImport: Boolean(priorImport) };
}

function previewFromPlan(plan: CutTimeBalancePlan, source: CutTimeMigrationSource, state: BalanceImportState): CutTimeBalanceImportPreview {
  const errors = [...plan.errors];
  if (state.priorImport) errors.push(message("BALANCES_ALREADY_IMPORTED", "A CutTime opening-balance import was already recorded for this program. Reverse or correct individual entries instead of importing a second balance sheet."));
  for (const balance of plan.balances) {
    if (!state.studentIds.has(balance.studentSourceId)) errors.push(message("UNKNOWN_BALANCE_STUDENT", `Opening balance references CutTime student ID ${balance.studentSourceId}, which was not found in Band Office.`));
  }
  return {
    ready: errors.length === 0,
    errors,
    warnings: plan.warnings,
    counts: {
      charges: plan.balances.filter((balance) => balance.amount > 0).length,
      credits: plan.balances.filter((balance) => balance.amount < 0).length,
      zeroBalances: plan.zeroBalances,
    },
    source: { filename: source.filename, rowCount: source.rows.length, mappedFields: plan.mappedFields },
  };
}

export async function previewCutTimeBalanceImport(db: DatabaseClient, programId: string, input: CutTimeBalanceImportInput) {
  const plan = planCutTimeBalanceImport(input);
  const state = await importState(db, programId, plan);
  return previewFromPlan(plan, input.source, state);
}

async function writeAudit(tx: TransactionClient, programId: string, actor: string, entityType: string, entityId: string, summary: string, fields: string[]) {
  await tx.auditLog.create({ data: { id: randomUUID(), programId, actor, action: "MIGRATE", entityType, entityId, changeSummary: summary, changeDiffJson: JSON.stringify({ fields, values: "[redacted]" }) } });
}

export async function commitCutTimeBalanceImport(db: DatabaseClient, input: { programId: string; operatingPeriodId: string; actor: string; balances: CutTimeBalanceImportInput }) {
  const preview = await previewCutTimeBalanceImport(db, input.programId, input.balances);
  if (!preview.ready) throw new Error(preview.errors[0]?.message ?? "The balance import is not ready.");
  const plan = planCutTimeBalanceImport(input.balances);
  if (!plan.cutoverAt) throw new Error("Choose the date the CutTime balance export represents.");
  const cutoverAt = plan.cutoverAt;
  const state = await importState(db, input.programId, plan);

  return db.$transaction(async (tx) => {
    const priorImport = await tx.migrationRun.findFirst({ where: { programId: input.programId, OR: [{ source: CUTTIME_BALANCES_SOURCE }, { source: CUTTIME_EXTERNAL_SOURCE, sources: { some: { sourceKind: "balances" } } }] }, select: { id: true } });
    if (priorImport) throw new Error("A CutTime opening-balance import was already recorded for this program. Reverse or correct individual entries instead of importing a second balance sheet.");
    const runId = randomUUID();
    const run = await tx.migrationRun.create({ data: { id: runId, programId: input.programId, source: CUTTIME_BALANCES_SOURCE, actor: input.actor, cutoverAt, summaryJson: JSON.stringify({ source: CUTTIME_BALANCES_SOURCE, charges: preview.counts.charges, credits: preview.counts.credits, zeroBalances: preview.counts.zeroBalances }) } });
    await tx.migrationSource.create({ data: { id: randomUUID(), migrationRunId: run.id, sourceKind: "balances", filename: input.balances.source.filename, contentHash: input.balances.source.contentHash, headersJson: JSON.stringify(input.balances.source.headers), mappingJson: JSON.stringify(plan.mappedFields), rowCount: input.balances.source.rows.length } });
    for (const balance of plan.balances) {
      const personId = state.studentIds.get(balance.studentSourceId);
      if (!personId) continue;
      const type = balance.amount > 0 ? FinancialEntryType.CHARGE : FinancialEntryType.CREDIT;
      const entry = await tx.financialEntry.create({ data: { id: randomUUID(), programId: input.programId, personId, operatingPeriodId: input.operatingPeriodId, type, amount: balance.amount, occurredAt: cutoverAt, description: `Imported CutTime opening balance as of ${input.balances.cutoverDate}`, reference: CUTTIME_BALANCES_SOURCE, createdBy: input.actor } });
      await tx.externalReference.create({ data: { id: randomUUID(), programId: input.programId, migrationRunId: run.id, source: CUTTIME_EXTERNAL_SOURCE, entityType: "OpeningBalance", sourceId: balance.studentSourceId, entityId: entry.id } });
      await writeAudit(tx, input.programId, input.actor, "FinancialEntry", entry.id, "Posted opening balance from CutTime import", ["personId", "operatingPeriodId", "type", "amount", "occurredAt", "description", "reference"]);
    }
    if (plan.warnings.length) await tx.migrationIssue.createMany({ data: plan.warnings.map((warning) => ({ id: randomUUID(), migrationRunId: run.id, code: warning.code, sourceKind: "balances", rowNumber: warning.rowNumber ?? null, message: warning.message })) });
    await writeAudit(tx, input.programId, input.actor, "MigrationRun", run.id, "Completed CutTime opening-balance import", ["source", "charges", "credits", "zeroBalances"]);
    return { runId: run.id, preview };
  });
}
