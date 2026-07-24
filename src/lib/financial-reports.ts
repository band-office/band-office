import { Prisma } from "@/generated/prisma/client";
import type { createPrismaClient } from "@/lib/db";

type DatabaseClient = ReturnType<typeof createPrismaClient>;

export type StudentBalanceRow = {
  personId: string;
  personName: string;
  schoolStudentId: string | null;
  grade: number;
  groups: string;
  chargeTotal: number;
  paymentTotal: number;
  creditTotal: number;
  reversalNet: number;
  balance: number;
  entryCount: number;
  lastActivityAt: string | null;
};

export type FinancialTransactionRow = {
  entryId: string;
  personId: string;
  personName: string;
  schoolStudentId: string | null;
  periodLabel: string;
  groupName: string | null;
  entryType: string;
  amount: number;
  occurredAt: string;
  dueDate: string | null;
  description: string;
  reference: string | null;
  reversalOfId: string | null;
  createdBy: string;
};

export type AssessmentBatchRow = {
  batchId: string;
  groupId: string;
  groupName: string;
  periodLabel: string;
  description: string;
  amountPerStudent: number;
  studentCount: number;
  totalAssessed: number;
  reversedCount: number;
  occurredAt: string;
  dueDate: string | null;
  createdBy: string;
};

export type FinancialSummaryRow = {
  studentAccountCount: number;
  positiveBalanceCount: number;
  outstandingTotal: number;
  creditBalanceTotal: number;
  currentCharges: number;
  currentPaymentsAndCredits: number;
};

export function studentBalances(db: DatabaseClient, programId: string, groupId?: string | null) {
  const selectedGroup = groupId || null;
  return db.$queryRaw<StudentBalanceRow[]>(Prisma.sql`
    SELECT
      person.id AS personId,
      person.lastName || ', ' || person.firstName AS personName,
      student.schoolStudentId AS schoolStudentId,
      student.grade AS grade,
      COALESCE((SELECT group_concat(group_record.name, ', ')
        FROM GroupMembership AS membership
        INNER JOIN "Group" AS group_record ON group_record.id = membership.groupId
        WHERE membership.personId = person.id AND membership.endedAt IS NULL), '') AS groups,
      ROUND(COALESCE(SUM(CASE WHEN entry.type = 'CHARGE' THEN CAST(entry.amount AS REAL) ELSE 0 END), 0), 2) AS chargeTotal,
      ROUND(COALESCE(SUM(CASE WHEN entry.type = 'PAYMENT' THEN -CAST(entry.amount AS REAL) ELSE 0 END), 0), 2) AS paymentTotal,
      ROUND(COALESCE(SUM(CASE WHEN entry.type = 'CREDIT' THEN -CAST(entry.amount AS REAL) ELSE 0 END), 0), 2) AS creditTotal,
      ROUND(COALESCE(SUM(CASE WHEN entry.type = 'REVERSAL' THEN CAST(entry.amount AS REAL) ELSE 0 END), 0), 2) AS reversalNet,
      ROUND(COALESCE(SUM(CAST(entry.amount AS REAL)), 0), 2) AS balance,
      COUNT(entry.id) AS entryCount,
      CAST(MAX(entry.occurredAt) AS TEXT) AS lastActivityAt
    FROM Person AS person
    INNER JOIN StudentProfile AS student ON student.personId = person.id
    LEFT JOIN FinancialEntry AS entry ON entry.personId = person.id
    WHERE person.programId = ${programId}
      AND (${selectedGroup} IS NULL OR EXISTS (
        SELECT 1 FROM GroupMembership AS selected_membership
        WHERE selected_membership.personId = person.id
          AND selected_membership.groupId = ${selectedGroup}
          AND selected_membership.endedAt IS NULL
      ))
    GROUP BY person.id, person.firstName, person.lastName, student.schoolStudentId, student.grade
    ORDER BY balance DESC, person.lastName, person.firstName
  `);
}

export function financialTransactions(db: DatabaseClient, programId: string, personId?: string | null) {
  const selectedPerson = personId || null;
  return db.$queryRaw<FinancialTransactionRow[]>(Prisma.sql`
    SELECT
      entry.id AS entryId,
      person.id AS personId,
      person.lastName || ', ' || person.firstName AS personName,
      student.schoolStudentId AS schoolStudentId,
      period.label AS periodLabel,
      group_record.name AS groupName,
      entry.type AS entryType,
      ROUND(CAST(entry.amount AS REAL), 2) AS amount,
      CAST(entry.occurredAt AS TEXT) AS occurredAt,
      CAST(entry.dueDate AS TEXT) AS dueDate,
      entry.description AS description,
      entry.reference AS reference,
      entry.reversalOfId AS reversalOfId,
      entry.createdBy AS createdBy
    FROM FinancialEntry AS entry
    INNER JOIN Person AS person ON person.id = entry.personId
    INNER JOIN StudentProfile AS student ON student.personId = person.id
    INNER JOIN OperatingPeriod AS period ON period.id = entry.operatingPeriodId
    LEFT JOIN "Group" AS group_record ON group_record.id = entry.groupId
    WHERE entry.programId = ${programId}
      AND (${selectedPerson} IS NULL OR entry.personId = ${selectedPerson})
    ORDER BY entry.occurredAt DESC, entry.createdAt DESC, entry.id DESC
  `);
}

export function assessmentBatches(db: DatabaseClient, programId: string) {
  return db.$queryRaw<AssessmentBatchRow[]>(Prisma.sql`
    SELECT
      batch.id AS batchId,
      batch.groupId AS groupId,
      group_record.name AS groupName,
      period.label AS periodLabel,
      batch.description AS description,
      ROUND(CAST(batch.amount AS REAL), 2) AS amountPerStudent,
      COUNT(entry.id) AS studentCount,
      ROUND(COUNT(entry.id) * CAST(batch.amount AS REAL), 2) AS totalAssessed,
      SUM(CASE WHEN EXISTS (SELECT 1 FROM FinancialEntry AS reversal WHERE reversal.reversalOfId = entry.id) THEN 1 ELSE 0 END) AS reversedCount,
      CAST(batch.occurredAt AS TEXT) AS occurredAt,
      CAST(batch.dueDate AS TEXT) AS dueDate,
      batch.createdBy AS createdBy
    FROM FinancialBatch AS batch
    INNER JOIN "Group" AS group_record ON group_record.id = batch.groupId
    INNER JOIN OperatingPeriod AS period ON period.id = batch.operatingPeriodId
    LEFT JOIN FinancialEntry AS entry ON entry.batchId = batch.id
    WHERE batch.programId = ${programId}
    GROUP BY batch.id, batch.groupId, group_record.name, period.label, batch.description, batch.amount, batch.occurredAt, batch.dueDate, batch.createdBy
    ORDER BY batch.occurredAt DESC, batch.createdAt DESC
  `);
}

export function financialSummary(db: DatabaseClient, programId: string, operatingPeriodId: string) {
  return db.$queryRaw<FinancialSummaryRow[]>(Prisma.sql`
    WITH account_balances AS (
      SELECT person.id, COALESCE(SUM(CAST(entry.amount AS REAL)), 0) AS balance
      FROM Person AS person
      INNER JOIN StudentProfile AS student ON student.personId = person.id
      LEFT JOIN FinancialEntry AS entry ON entry.personId = person.id
      WHERE person.programId = ${programId}
      GROUP BY person.id
    )
    SELECT
      COUNT(account_balances.id) AS studentAccountCount,
      SUM(CASE WHEN account_balances.balance > 0.004 THEN 1 ELSE 0 END) AS positiveBalanceCount,
      ROUND(SUM(CASE WHEN account_balances.balance > 0 THEN account_balances.balance ELSE 0 END), 2) AS outstandingTotal,
      ROUND(-SUM(CASE WHEN account_balances.balance < 0 THEN account_balances.balance ELSE 0 END), 2) AS creditBalanceTotal,
      ROUND(COALESCE((SELECT SUM(CAST(entry.amount AS REAL)) FROM FinancialEntry AS entry WHERE entry.programId = ${programId} AND entry.operatingPeriodId = ${operatingPeriodId} AND entry.type = 'CHARGE'), 0), 2) AS currentCharges,
      ROUND(-COALESCE((SELECT SUM(CAST(entry.amount AS REAL)) FROM FinancialEntry AS entry WHERE entry.programId = ${programId} AND entry.operatingPeriodId = ${operatingPeriodId} AND entry.type IN ('PAYMENT', 'CREDIT')), 0), 2) AS currentPaymentsAndCredits
    FROM account_balances
  `);
}
