import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import type { createPrismaClient } from "@/lib/db";
import type {
  CutTimeLibraryImportInput,
  CutTimeLibraryImportPreview,
  CutTimeMigrationMessage,
  CutTimeMigrationSource,
} from "@/lib/cuttime-migration-types";

type DatabaseClient = ReturnType<typeof createPrismaClient>;
type TransactionClient = Prisma.TransactionClient;

export const CUTTIME_LIBRARY_SOURCE = "CUTTIME_LIBRARY";
const CUTTIME_EXTERNAL_SOURCE = "CUTTIME";
const MAX_ROWS = 5_000;
const MAX_CELL_LENGTH = 2_000;

type PlannedLibraryItem = {
  sourceId: string;
  title: string;
  composer: string | null;
  arranger: string | null;
  publisher: string | null;
  grade: string | null;
  category: string | null;
  catalogNumber: string | null;
  storageLocation: string | null;
  acquisitionDate: Date | null;
  acquisitionCost: number | null;
  comments: string | null;
};

export type CutTimeLibraryPlan = {
  items: PlannedLibraryItem[];
  errors: CutTimeMigrationMessage[];
  warnings: CutTimeMigrationMessage[];
  mappedFields: string[];
};

function message(code: string, content: string, rowNumber?: number): CutTimeMigrationMessage {
  return { code, message: content, sourceKind: "library", rowNumber };
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

const LIBRARY_FIELDS = [
  { label: "Title", aliases: ["title"] },
  { label: "Category", aliases: ["category"] },
  { label: "Instrumentation / voicing", aliases: ["instrumentation/voicing", "instrumentation", "voicing"] },
  { label: "Composer", aliases: ["composer"] },
  { label: "Arranger", aliases: ["arranger"] },
  { label: "Grade", aliases: ["grade"] },
  { label: "Storage location", aliases: ["storage location", "location"] },
  { label: "Library number", aliases: ["library number", "catalog number"] },
  { label: "Barcode", aliases: ["barcode"] },
  { label: "Publisher", aliases: ["publisher"] },
  { label: "Publisher number", aliases: ["publisher number", "publisher #", "publisher no"] },
  { label: "Purchase date", aliases: ["date purchased", "purchase date", "acquisition date"] },
  { label: "Purchase price", aliases: ["purchase price", "acquisition cost", "cost"] },
  { label: "Notes", aliases: ["notes", "performance notes"] },
] as const;

export function cutTimeLibraryMappedFields(source: CutTimeMigrationSource) {
  const available = new Set(source.headers.map(headerKey));
  return LIBRARY_FIELDS.filter((field) => field.aliases.some((alias) => available.has(headerKey(alias)))).map((field) => field.label);
}

function parseMoney(value: string) {
  const normalized = value.trim().replaceAll("$", "").replaceAll(",", "").replace(/^\((.*)\)$/, "-$1");
  if (!normalized) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 && Math.round(amount * 100) === amount * 100 ? amount : null;
}

function parseDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const serial = Number(trimmed);
  if (Number.isFinite(serial) && serial > 1 && serial < 100_000) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
}

function libraryComments(row: Record<string, string>) {
  const notes = firstValue(row, ["notes"]);
  const metadata = [
    ["Instrumentation / voicing", firstValue(row, ["instrumentation/voicing", "instrumentation", "voicing"])],
    ["Author", firstValue(row, ["author"])],
    ["Barcode", firstValue(row, ["barcode"])],
    ["Publisher number", firstValue(row, ["publisher number", "publisher #", "publisher no"])],
    ["State list number", firstValue(row, ["state list number"])],
    ["State grade", firstValue(row, ["state grade"])],
    ["Copyright year", firstValue(row, ["copyright year"])],
    ["Out of print", firstValue(row, ["out of print"])],
    ["Performance notes", firstValue(row, ["performance notes"])],
  ].filter(([, value]) => Boolean(value)).map(([label, value]) => `${label}: ${value}`);
  return [notes, metadata.length ? `Imported CutTime metadata\n${metadata.join("\n")}` : ""].filter(Boolean).join("\n\n") || null;
}

export function planCutTimeLibrarySource(source: CutTimeMigrationSource): CutTimeLibraryPlan {
  const errors: CutTimeMigrationMessage[] = [];
  const warnings: CutTimeMigrationMessage[] = [];
  const items: PlannedLibraryItem[] = [];
  const mappedFields = cutTimeLibraryMappedFields(source);

  if (source.kind !== "library") errors.push(message("INVALID_LIBRARY_SOURCE", "The selected file is not marked as a CutTime library export."));
  if (!source.filename || !source.contentHash || !Array.isArray(source.headers) || !Array.isArray(source.rows)) {
    errors.push(message("INVALID_LIBRARY_SOURCE", "The library export could not be read. Remove it and select it again."));
    return { items, errors, warnings, mappedFields };
  }
  if (source.rows.length > MAX_ROWS) errors.push(message("LIBRARY_SOURCE_TOO_LARGE", `${source.filename} has more than ${MAX_ROWS.toLocaleString()} rows. Split the export before importing.`));
  if (source.rows.some((row) => Object.values(row).some((value) => String(value).length > MAX_CELL_LENGTH))) errors.push(message("LIBRARY_CELL_TOO_LARGE", `${source.filename} contains a value longer than ${MAX_CELL_LENGTH.toLocaleString()} characters.`));

  const sourceIds = new Set<string>();
  for (const [index, row] of source.rows.entries()) {
    const rowNumber = index + 2;
    const title = firstValue(row, ["title"]);
    if (!title) {
      errors.push(message("LIBRARY_TITLE_REQUIRED", "Each music-library row needs a title.", rowNumber));
      continue;
    }
    const sourceId = firstValue(row, ["id", "library number", "catalog number", "barcode"]) || `library-row-${rowNumber}`;
    if (sourceIds.has(sourceId)) {
      errors.push(message("DUPLICATE_LIBRARY_ID", `Library identifier ${sourceId} appears more than once.`, rowNumber));
      continue;
    }
    sourceIds.add(sourceId);
    const purchaseDateText = firstValue(row, ["date purchased", "purchase date", "acquisition date"]);
    const acquisitionDate = parseDate(purchaseDateText);
    if (purchaseDateText && !acquisitionDate) warnings.push(message("UNKNOWN_PURCHASE_DATE", `${title} has an unrecognized purchase date. It will import without a purchase date.`, rowNumber));
    const purchasePriceText = firstValue(row, ["purchase price", "acquisition cost", "cost"]);
    const acquisitionCost = parseMoney(purchasePriceText);
    if (purchasePriceText && acquisitionCost === null) warnings.push(message("UNKNOWN_PURCHASE_PRICE", `${title} has an unrecognized purchase price. It will import without a purchase price.`, rowNumber));
    items.push({
      sourceId,
      title,
      composer: firstValue(row, ["composer"]) || null,
      arranger: firstValue(row, ["arranger"]) || null,
      publisher: firstValue(row, ["publisher"]) || null,
      grade: firstValue(row, ["grade"]) || null,
      category: firstValue(row, ["category"]) || null,
      catalogNumber: firstValue(row, ["library number", "catalog number", "barcode"]) || null,
      storageLocation: firstValue(row, ["storage location", "location"]) || null,
      acquisitionDate,
      acquisitionCost,
      comments: libraryComments(row),
    });
  }

  const catalogNumbers = new Map<string, PlannedLibraryItem[]>();
  for (const item of items) {
    if (!item.catalogNumber) continue;
    const key = item.catalogNumber.toLowerCase();
    const current = catalogNumbers.get(key) ?? [];
    current.push(item);
    catalogNumbers.set(key, current);
  }
  for (const [catalogNumber, duplicates] of catalogNumbers) {
    if (duplicates.length < 2) continue;
    for (const item of duplicates) {
      item.comments = [item.comments, `Imported CutTime library number: ${item.catalogNumber}`].filter(Boolean).join("\n\n");
      item.catalogNumber = null;
    }
    warnings.push(message("DUPLICATE_LIBRARY_NUMBER", `Library number ${catalogNumber} appears more than once. Those records will import without a catalog number for director review.`));
  }

  return { items, errors, warnings, mappedFields };
}

async function writeAudit(tx: TransactionClient, programId: string, actor: string, entityId: string) {
  await tx.auditLog.create({
    data: {
      id: randomUUID(),
      programId,
      actor,
      action: "MIGRATE",
      entityType: "LibraryItem",
      entityId,
      changeSummary: "Created music library record from CutTime import",
      changeDiffJson: JSON.stringify({ fields: ["title", "composer", "arranger", "publisher", "grade", "category", "catalogNumber", "storageLocation", "acquisitionDate", "acquisitionCost", "comments"], values: "[redacted]" }),
    },
  });
}

function previewFromPlan(plan: CutTimeLibraryPlan, source: CutTimeMigrationSource): CutTimeLibraryImportPreview {
  return {
    ready: plan.errors.length === 0,
    errors: plan.errors,
    warnings: plan.warnings,
    count: plan.items.length,
    source: { filename: source.filename, rowCount: source.rows.length, mappedFields: plan.mappedFields },
  };
}

export async function previewCutTimeLibraryImport(db: DatabaseClient, programId: string, input: CutTimeLibraryImportInput) {
  const plan = planCutTimeLibrarySource(input.source);
  if (!plan.errors.length) {
    const [existingReferences, existingCatalogs] = await Promise.all([
      db.externalReference.findMany({ where: { programId, source: CUTTIME_EXTERNAL_SOURCE, entityType: "LibraryItem", sourceId: { in: plan.items.map((item) => item.sourceId) } }, select: { sourceId: true } }),
      db.libraryItem.findMany({ where: { programId, catalogNumber: { in: plan.items.flatMap((item) => item.catalogNumber ? [item.catalogNumber] : []) } }, select: { catalogNumber: true } }),
    ]);
    for (const reference of existingReferences) plan.errors.push(message("LIBRARY_ALREADY_IMPORTED", `CutTime library identifier ${reference.sourceId} was already imported into this program.`, undefined));
    for (const item of existingCatalogs) if (item.catalogNumber) plan.errors.push(message("LIBRARY_CATALOG_EXISTS", `Catalog number ${item.catalogNumber} already exists in this Band Office library.`, undefined));
  }
  return previewFromPlan(plan, input.source);
}

export async function commitCutTimeLibraryImport(db: DatabaseClient, input: { programId: string; actor: string; library: CutTimeLibraryImportInput }) {
  const preview = await previewCutTimeLibraryImport(db, input.programId, input.library);
  if (!preview.ready) throw new Error(preview.errors[0]?.message ?? "The library import is not ready.");
  const plan = planCutTimeLibrarySource(input.library.source);

  return db.$transaction(async (tx) => {
    const runId = randomUUID();
    const run = await tx.migrationRun.create({
      data: {
        id: runId,
        programId: input.programId,
        source: CUTTIME_LIBRARY_SOURCE,
        actor: input.actor,
        cutoverAt: new Date(),
        summaryJson: JSON.stringify({ source: CUTTIME_LIBRARY_SOURCE, libraryItems: plan.items.length, warnings: plan.warnings.length }),
      },
    });
    await tx.migrationSource.create({ data: { id: randomUUID(), migrationRunId: run.id, sourceKind: "library", filename: input.library.source.filename, contentHash: input.library.source.contentHash, headersJson: JSON.stringify(input.library.source.headers), mappingJson: JSON.stringify(plan.mappedFields), rowCount: input.library.source.rows.length } });
    for (const item of plan.items) {
      const itemId = randomUUID();
      await tx.libraryItem.create({ data: { id: itemId, programId: input.programId, title: item.title, composer: item.composer, arranger: item.arranger, publisher: item.publisher, grade: item.grade, category: item.category, catalogNumber: item.catalogNumber, storageLocation: item.storageLocation, acquisitionDate: item.acquisitionDate, acquisitionSource: "Imported from CutTime", acquisitionCost: item.acquisitionCost, comments: item.comments } });
      await tx.externalReference.create({ data: { id: randomUUID(), programId: input.programId, migrationRunId: run.id, source: CUTTIME_EXTERNAL_SOURCE, entityType: "LibraryItem", sourceId: item.sourceId, entityId: itemId } });
      await writeAudit(tx, input.programId, input.actor, itemId);
    }
    if (plan.warnings.length) await tx.migrationIssue.createMany({ data: plan.warnings.map((warning) => ({ id: randomUUID(), migrationRunId: run.id, code: warning.code, sourceKind: "library", rowNumber: warning.rowNumber ?? null, message: warning.message })) });
    await tx.auditLog.create({ data: { id: randomUUID(), programId: input.programId, actor: input.actor, action: "MIGRATE", entityType: "MigrationRun", entityId: run.id, changeSummary: "Completed CutTime music-library import", changeDiffJson: JSON.stringify({ fields: ["source", "libraryItems", "warnings"], values: "[redacted]" }) } });
    return { runId: run.id, preview: previewFromPlan(plan, input.library.source) };
  });
}
