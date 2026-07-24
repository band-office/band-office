import { randomUUID } from "node:crypto";
import {
  LibraryComponentStatus,
  LibraryItemStatus,
  LibraryLoanStatus,
  LibraryResourceKind,
  LibraryResourceStatus,
  Prisma,
} from "@/generated/prisma/client";
import type { createPrismaClient } from "@/lib/db";

type DatabaseClient = ReturnType<typeof createPrismaClient>;
type TransactionClient = Prisma.TransactionClient;

export class LibraryInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LibraryInvariantError";
  }
}

function required(value: string, label: string) {
  const clean = value.trim();
  if (!clean) throw new LibraryInvariantError(`${label} is required.`);
  return clean;
}

function optional(value: string | null | undefined) {
  return value?.trim() || null;
}

function optionalMoney(value: string | number | Prisma.Decimal | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  let amount: Prisma.Decimal;
  try {
    amount = new Prisma.Decimal(value);
  } catch {
    throw new LibraryInvariantError("Enter a valid acquisition cost.");
  }
  if (!amount.isFinite() || amount.lt(0) || amount.decimalPlaces() > 2) {
    throw new LibraryInvariantError("Acquisition cost must be a non-negative amount with no more than two decimal places.");
  }
  return amount;
}

async function appendAudit(tx: TransactionClient, input: {
  programId: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  fields: string[];
}) {
  await tx.auditLog.create({
    data: {
      id: randomUUID(),
      programId: input.programId,
      actor: input.actor,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      changeSummary: input.summary,
      changeDiffJson: JSON.stringify({ fields: input.fields, values: "[redacted]" }),
    },
  });
}

async function getProgramItem(tx: TransactionClient, itemId: string) {
  const item = await tx.libraryItem.findUnique({ where: { id: itemId } });
  if (!item) throw new LibraryInvariantError("Library item not found.");
  return item;
}

async function availableStatus(tx: TransactionClient, itemId: string) {
  const unresolved = await tx.libraryComponentNote.count({
    where: { itemId, resolvedAt: null, status: { in: [LibraryComponentStatus.MISSING, LibraryComponentStatus.DAMAGED] } },
  });
  return unresolved ? LibraryItemStatus.INCOMPLETE : LibraryItemStatus.AVAILABLE;
}

export async function createLibraryItem(db: DatabaseClient, input: {
  id?: string;
  programId: string;
  title: string;
  composer?: string | null;
  arranger?: string | null;
  publisher?: string | null;
  grade?: string | null;
  category?: string | null;
  catalogNumber?: string | null;
  storageLocation?: string | null;
  acquisitionDate?: Date | null;
  acquisitionSource?: string | null;
  acquisitionCost?: string | number | Prisma.Decimal | null;
  comments?: string | null;
}, actor: string) {
  const title = required(input.title, "Title");
  return db.$transaction(async (tx) => {
    const program = await tx.program.findUnique({ where: { id: input.programId } });
    if (!program) throw new LibraryInvariantError("Program not found.");
    const item = await tx.libraryItem.create({
      data: {
        id: input.id ?? randomUUID(),
        programId: input.programId,
        title,
        composer: optional(input.composer),
        arranger: optional(input.arranger),
        publisher: optional(input.publisher),
        grade: optional(input.grade),
        category: optional(input.category),
        catalogNumber: optional(input.catalogNumber),
        storageLocation: optional(input.storageLocation),
        acquisitionDate: input.acquisitionDate,
        acquisitionSource: optional(input.acquisitionSource),
        acquisitionCost: optionalMoney(input.acquisitionCost),
        comments: optional(input.comments),
      },
    });
    await appendAudit(tx, {
      programId: item.programId,
      actor,
      action: "CREATE",
      entityType: "LibraryItem",
      entityId: item.id,
      summary: "Added whole-set music library record",
      fields: ["title", "composer", "arranger", "publisher", "grade", "category", "catalogNumber", "storageLocation", "acquisitionDate", "acquisitionSource", "acquisitionCost", "comments"],
    });
    return item;
  });
}

export async function updateLibraryItem(db: DatabaseClient, itemId: string, input: {
  title: string;
  composer?: string | null;
  arranger?: string | null;
  publisher?: string | null;
  grade?: string | null;
  category?: string | null;
  catalogNumber?: string | null;
  storageLocation?: string | null;
  acquisitionDate?: Date | null;
  acquisitionSource?: string | null;
  acquisitionCost?: string | number | Prisma.Decimal | null;
  comments?: string | null;
}, actor: string) {
  return db.$transaction(async (tx) => {
    const existing = await getProgramItem(tx, itemId);
    const item = await tx.libraryItem.update({
      where: { id: itemId },
      data: {
        title: required(input.title, "Title"),
        composer: optional(input.composer),
        arranger: optional(input.arranger),
        publisher: optional(input.publisher),
        grade: optional(input.grade),
        category: optional(input.category),
        catalogNumber: optional(input.catalogNumber),
        storageLocation: optional(input.storageLocation),
        acquisitionDate: input.acquisitionDate,
        acquisitionSource: optional(input.acquisitionSource),
        acquisitionCost: optionalMoney(input.acquisitionCost),
        comments: optional(input.comments),
      },
    });
    await appendAudit(tx, {
      programId: existing.programId,
      actor,
      action: "UPDATE",
      entityType: "LibraryItem",
      entityId: item.id,
      summary: "Updated music library record",
      fields: ["title", "composer", "arranger", "publisher", "grade", "category", "catalogNumber", "storageLocation", "acquisitionDate", "acquisitionSource", "acquisitionCost", "comments"],
    });
    return item;
  });
}

export async function archiveLibraryItem(db: DatabaseClient, itemId: string, actor: string) {
  return db.$transaction(async (tx) => {
    const item = await getProgramItem(tx, itemId);
    const activeLoan = await tx.libraryLoan.count({ where: { itemId, returnedAt: null, status: LibraryLoanStatus.CHECKED_OUT } });
    if (activeLoan) throw new LibraryInvariantError("Return or resolve the active loan before archiving this set.");
    const archived = await tx.libraryItem.update({ where: { id: itemId }, data: { status: LibraryItemStatus.ARCHIVED } });
    await appendAudit(tx, { programId: item.programId, actor, action: "ARCHIVE", entityType: "LibraryItem", entityId: item.id, summary: "Archived music library record", fields: ["status"] });
    return archived;
  });
}

export async function addLibraryComponentNote(db: DatabaseClient, input: {
  id?: string;
  itemId: string;
  componentName: string;
  status: Exclude<LibraryComponentStatus, "REPLACED">;
  notedAt: Date;
  notes?: string | null;
}, actor: string) {
  if (![LibraryComponentStatus.MISSING, LibraryComponentStatus.DAMAGED].includes(input.status)) {
    throw new LibraryInvariantError("New component issues must be missing or damaged.");
  }
  return db.$transaction(async (tx) => {
    const item = await getProgramItem(tx, input.itemId);
    if (item.status === LibraryItemStatus.ARCHIVED) throw new LibraryInvariantError("Archived library records cannot receive new component issues.");
    const note = await tx.libraryComponentNote.create({
      data: { id: input.id ?? randomUUID(), itemId: input.itemId, componentName: required(input.componentName, "Component"), status: input.status, notedAt: input.notedAt, notes: optional(input.notes), createdBy: actor },
    });
    if (item.status === LibraryItemStatus.AVAILABLE) await tx.libraryItem.update({ where: { id: item.id }, data: { status: LibraryItemStatus.INCOMPLETE } });
    await appendAudit(tx, { programId: item.programId, actor, action: "CREATE", entityType: "LibraryComponentNote", entityId: note.id, summary: "Recorded missing or damaged music component", fields: ["itemId", "componentName", "status", "notedAt", "notes"] });
    return note;
  });
}

export async function resolveLibraryComponentNote(db: DatabaseClient, noteId: string, resolvedAt: Date, actor: string) {
  return db.$transaction(async (tx) => {
    const existing = await tx.libraryComponentNote.findUnique({ where: { id: noteId }, include: { item: true } });
    if (!existing) throw new LibraryInvariantError("Component issue not found.");
    if (existing.resolvedAt) throw new LibraryInvariantError("This component issue is already resolved.");
    const note = await tx.libraryComponentNote.update({ where: { id: noteId }, data: { status: LibraryComponentStatus.REPLACED, resolvedAt } });
    if (existing.item.status === LibraryItemStatus.INCOMPLETE) {
      await tx.libraryItem.update({ where: { id: existing.itemId }, data: { status: await availableStatus(tx, existing.itemId) } });
    }
    await appendAudit(tx, { programId: existing.item.programId, actor, action: "RESOLVE", entityType: "LibraryComponentNote", entityId: note.id, summary: "Resolved music component issue", fields: ["status", "resolvedAt"] });
    return note;
  });
}

export async function checkoutLibraryItem(db: DatabaseClient, input: {
  id?: string;
  itemId: string;
  borrowerPersonId?: string | null;
  borrowerName?: string | null;
  operatingPeriodId: string;
  checkedOutAt: Date;
  expectedReturnAt?: Date | null;
  notes?: string | null;
}, actor: string) {
  return db.$transaction(async (tx) => {
    const item = await getProgramItem(tx, input.itemId);
    if (item.status !== LibraryItemStatus.AVAILABLE) throw new LibraryInvariantError("Only a complete, available set can be checked out.");
    const period = await tx.operatingPeriod.findUnique({ where: { id: input.operatingPeriodId } });
    if (!period || period.programId !== item.programId) throw new LibraryInvariantError("Choose an operating period from this program.");
    if (input.expectedReturnAt && input.expectedReturnAt < input.checkedOutAt) throw new LibraryInvariantError("Expected return cannot be before checkout.");
    let borrowerName = optional(input.borrowerName);
    if (input.borrowerPersonId) {
      const person = await tx.person.findUnique({ where: { id: input.borrowerPersonId } });
      if (!person || person.programId !== item.programId) throw new LibraryInvariantError("Choose a borrower from this program.");
      borrowerName = `${person.firstName} ${person.lastName}`.trim();
    }
    if (!borrowerName) throw new LibraryInvariantError("Choose a person or enter an external borrower.");
    const activeLoan = await tx.libraryLoan.count({ where: { itemId: item.id, returnedAt: null, status: LibraryLoanStatus.CHECKED_OUT } });
    if (activeLoan) throw new LibraryInvariantError("This set already has an active loan.");
    const loan = await tx.libraryLoan.create({
      data: { id: input.id ?? randomUUID(), itemId: item.id, borrowerPersonId: input.borrowerPersonId, borrowerName, operatingPeriodId: input.operatingPeriodId, checkedOutAt: input.checkedOutAt, expectedReturnAt: input.expectedReturnAt, notes: optional(input.notes), createdBy: actor },
    });
    await tx.libraryItem.update({ where: { id: item.id }, data: { status: LibraryItemStatus.ON_LOAN } });
    await appendAudit(tx, { programId: item.programId, actor, action: "CHECKOUT", entityType: "LibraryLoan", entityId: loan.id, summary: "Checked out complete music set", fields: ["itemId", "borrowerPersonId", "borrowerName", "operatingPeriodId", "checkedOutAt", "expectedReturnAt", "notes"] });
    return loan;
  });
}

export async function closeLibraryLoan(db: DatabaseClient, loanId: string, input: {
  returnedAt: Date;
  status: Extract<LibraryLoanStatus, "RETURNED" | "LOST">;
  notes?: string | null;
}, actor: string) {
  if (![LibraryLoanStatus.RETURNED, LibraryLoanStatus.LOST].includes(input.status)) throw new LibraryInvariantError("Choose returned or lost.");
  return db.$transaction(async (tx) => {
    const existing = await tx.libraryLoan.findUnique({ where: { id: loanId }, include: { item: true } });
    if (!existing) throw new LibraryInvariantError("Library loan not found.");
    if (existing.returnedAt || existing.status !== LibraryLoanStatus.CHECKED_OUT) throw new LibraryInvariantError("This loan is already closed.");
    if (input.returnedAt < existing.checkedOutAt) throw new LibraryInvariantError("Return date cannot be before checkout.");
    const loan = await tx.libraryLoan.update({ where: { id: loanId }, data: { returnedAt: input.returnedAt, status: input.status, notes: optional(input.notes) ?? existing.notes } });
    const itemStatus = input.status === LibraryLoanStatus.LOST ? LibraryItemStatus.MISSING : await availableStatus(tx, existing.itemId);
    await tx.libraryItem.update({ where: { id: existing.itemId }, data: { status: itemStatus } });
    await appendAudit(tx, { programId: existing.item.programId, actor, action: input.status === LibraryLoanStatus.LOST ? "MARK_LOST" : "CHECKIN", entityType: "LibraryLoan", entityId: loan.id, summary: input.status === LibraryLoanStatus.LOST ? "Closed music loan as lost" : "Returned complete music set", fields: ["returnedAt", "status", "notes"] });
    return loan;
  });
}

export async function addPerformanceRecord(db: DatabaseClient, input: {
  id?: string;
  itemId: string;
  operatingPeriodId: string;
  eventName: string;
  performedAt: Date;
  groupId?: string | null;
  conductor?: string | null;
  notes?: string | null;
}, actor: string) {
  return db.$transaction(async (tx) => {
    const item = await getProgramItem(tx, input.itemId);
    const period = await tx.operatingPeriod.findUnique({ where: { id: input.operatingPeriodId } });
    if (!period || period.programId !== item.programId) throw new LibraryInvariantError("Choose an operating period from this program.");
    if (input.groupId) {
      const group = await tx.group.findUnique({ where: { id: input.groupId } });
      if (!group || group.programId !== item.programId) throw new LibraryInvariantError("Choose a group from this program.");
    }
    const record = await tx.performanceRecord.create({
      data: { id: input.id ?? randomUUID(), itemId: item.id, operatingPeriodId: input.operatingPeriodId, eventName: required(input.eventName, "Performance or event"), performedAt: input.performedAt, groupId: input.groupId, conductor: optional(input.conductor), notes: optional(input.notes), createdBy: actor },
    });
    await appendAudit(tx, { programId: item.programId, actor, action: "CREATE", entityType: "PerformanceRecord", entityId: record.id, summary: "Added music performance history", fields: ["itemId", "operatingPeriodId", "eventName", "performedAt", "groupId", "conductor", "notes"] });
    return record;
  });
}

export async function addLibraryResource(db: DatabaseClient, input: {
  id?: string;
  itemId: string;
  kind: LibraryResourceKind;
  label: string;
  fileName?: string | null;
  mimeType?: string | null;
  byteSize?: number | null;
  storageKey?: string | null;
  contentHash?: string | null;
  externalUrl?: string | null;
  copyrightAcknowledgedAt: Date;
}, actor: string) {
  return db.$transaction(async (tx) => {
    const item = await getProgramItem(tx, input.itemId);
    if (item.status === LibraryItemStatus.ARCHIVED) throw new LibraryInvariantError("Archived library records cannot receive new resources.");
    if (input.kind === LibraryResourceKind.LOCAL_FILE && (!input.storageKey || !input.fileName || !input.contentHash || !input.byteSize)) throw new LibraryInvariantError("Local file metadata is incomplete.");
    if (input.kind === LibraryResourceKind.EXTERNAL_LINK) {
      let url: URL;
      try { url = new URL(input.externalUrl ?? ""); } catch { throw new LibraryInvariantError("Enter a valid resource link."); }
      if (url.protocol !== "https:") throw new LibraryInvariantError("Resource links must use HTTPS.");
    }
    const resource = await tx.libraryResource.create({
      data: {
        id: input.id ?? randomUUID(), itemId: item.id, kind: input.kind, label: required(input.label, "Resource label"),
        fileName: optional(input.fileName), mimeType: optional(input.mimeType), byteSize: input.byteSize, storageKey: optional(input.storageKey), contentHash: optional(input.contentHash), externalUrl: optional(input.externalUrl), copyrightAcknowledgedAt: input.copyrightAcknowledgedAt, createdBy: actor,
      },
    });
    await appendAudit(tx, { programId: item.programId, actor, action: "CREATE", entityType: "LibraryResource", entityId: resource.id, summary: `Added ${input.kind === LibraryResourceKind.LOCAL_FILE ? "managed file" : "external link"} to music library`, fields: ["itemId", "kind", "label", "fileName", "mimeType", "byteSize", "storageKey", "contentHash", "externalUrl", "copyrightAcknowledgedAt"] });
    return resource;
  });
}

export async function removeLibraryResource(db: DatabaseClient, resourceId: string, actor: string) {
  return db.$transaction(async (tx) => {
    const existing = await tx.libraryResource.findUnique({ where: { id: resourceId }, include: { item: true } });
    if (!existing) throw new LibraryInvariantError("Library resource not found.");
    if (existing.status === LibraryResourceStatus.REMOVED) throw new LibraryInvariantError("This resource is already removed.");
    const resource = await tx.libraryResource.update({ where: { id: resourceId }, data: { status: LibraryResourceStatus.REMOVED, removedAt: new Date() } });
    await appendAudit(tx, { programId: existing.item.programId, actor, action: "REMOVE", entityType: "LibraryResource", entityId: resource.id, summary: "Removed music library resource", fields: ["status", "removedAt"] });
    return resource;
  });
}
