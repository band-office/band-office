import { Prisma } from "@/generated/prisma/client";
import type { createPrismaClient } from "@/lib/db";

type DatabaseClient = ReturnType<typeof createPrismaClient>;

export type LibraryCatalogRow = Record<string, unknown> & {
  itemId: string;
  title: string;
  composer: string | null;
  arranger: string | null;
  publisher: string | null;
  grade: string | null;
  category: string | null;
  catalogNumber: string | null;
  storageLocation: string | null;
  status: string;
  unresolvedComponents: number;
  performanceCount: number;
  resourceCount: number;
};

export type LibraryLoanRow = Record<string, unknown> & {
  loanId: string;
  itemId: string;
  title: string;
  composer: string | null;
  borrowerName: string;
  checkedOutAt: string;
  expectedReturnAt: string | null;
  returnedAt: string | null;
  status: string;
  periodLabel: string;
  daysOverdue: number;
};

export function libraryCatalog(db: DatabaseClient, programId: string) {
  return db.$queryRaw<LibraryCatalogRow[]>(Prisma.sql`
    SELECT item.id AS itemId, item.title, item.composer, item.arranger, item.publisher,
      item.grade, item.category, item.catalogNumber, item.storageLocation, item.status,
      (SELECT COUNT(*) FROM LibraryComponentNote AS component
        WHERE component.itemId = item.id AND component.resolvedAt IS NULL
          AND component.status IN ('MISSING', 'DAMAGED')) AS unresolvedComponents,
      (SELECT COUNT(*) FROM PerformanceRecord AS performance WHERE performance.itemId = item.id) AS performanceCount,
      (SELECT COUNT(*) FROM LibraryResource AS resource
        WHERE resource.itemId = item.id AND resource.status = 'ACTIVE') AS resourceCount
    FROM LibraryItem AS item
    WHERE item.programId = ${programId}
    ORDER BY item.title, item.composer
  `);
}

export function libraryLoans(db: DatabaseClient, programId: string, activeOnly = false, asOf = new Date()) {
  const activeClause = activeOnly ? Prisma.sql`AND loan.returnedAt IS NULL AND loan.status = 'CHECKED_OUT'` : Prisma.empty;
  return db.$queryRaw<LibraryLoanRow[]>(Prisma.sql`
    SELECT loan.id AS loanId, item.id AS itemId, item.title, item.composer,
      loan.borrowerName, CAST(loan.checkedOutAt AS TEXT) AS checkedOutAt,
      CAST(loan.expectedReturnAt AS TEXT) AS expectedReturnAt,
      CAST(loan.returnedAt AS TEXT) AS returnedAt, loan.status, period.label AS periodLabel,
      CASE WHEN loan.returnedAt IS NULL AND loan.expectedReturnAt IS NOT NULL AND loan.expectedReturnAt < ${asOf.toISOString()}
        THEN CAST(julianday(${asOf.toISOString()}) - julianday(loan.expectedReturnAt) AS INTEGER) ELSE 0 END AS daysOverdue
    FROM LibraryLoan AS loan
    INNER JOIN LibraryItem AS item ON item.id = loan.itemId
    INNER JOIN OperatingPeriod AS period ON period.id = loan.operatingPeriodId
    WHERE item.programId = ${programId} ${activeClause}
    ORDER BY CASE WHEN loan.returnedAt IS NULL THEN 0 ELSE 1 END, loan.expectedReturnAt, loan.checkedOutAt DESC
  `);
}

export async function overdueLibraryLoans(db: DatabaseClient, programId: string, asOf = new Date()) {
  const rows = await libraryLoans(db, programId, true, asOf);
  return rows.filter((row) => Number(row.daysOverdue) > 0);
}

export function libraryComponentIssues(db: DatabaseClient, programId: string) {
  return db.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT component.id AS componentNoteId, item.id AS itemId, item.title, item.composer,
      component.componentName, component.status, CAST(component.notedAt AS TEXT) AS notedAt,
      CAST(component.resolvedAt AS TEXT) AS resolvedAt, component.notes
    FROM LibraryComponentNote AS component
    INNER JOIN LibraryItem AS item ON item.id = component.itemId
    WHERE item.programId = ${programId}
    ORDER BY CASE WHEN component.resolvedAt IS NULL THEN 0 ELSE 1 END, component.notedAt DESC, item.title
  `);
}

export function libraryPerformanceHistory(db: DatabaseClient, programId: string) {
  return db.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT performance.id AS performanceId, item.id AS itemId, item.title, item.composer,
      performance.eventName, CAST(performance.performedAt AS TEXT) AS performedAt,
      group_record.name AS groupName, performance.conductor, period.label AS periodLabel, performance.notes
    FROM PerformanceRecord AS performance
    INNER JOIN LibraryItem AS item ON item.id = performance.itemId
    INNER JOIN OperatingPeriod AS period ON period.id = performance.operatingPeriodId
    LEFT JOIN "Group" AS group_record ON group_record.id = performance.groupId
    WHERE item.programId = ${programId}
    ORDER BY performance.performedAt DESC, item.title
  `);
}

export function libraryResourcePresence(db: DatabaseClient, programId: string) {
  return db.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT resource.id AS resourceId, item.id AS itemId, item.title, item.composer,
      resource.kind, resource.label, resource.fileName, resource.mimeType, resource.byteSize,
      resource.externalUrl, resource.contentHash, CAST(resource.createdAt AS TEXT) AS createdAt,
      resource.status
    FROM LibraryResource AS resource
    INNER JOIN LibraryItem AS item ON item.id = resource.itemId
    WHERE item.programId = ${programId}
    ORDER BY item.title, resource.createdAt DESC
  `);
}
