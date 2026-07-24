import { Prisma } from "@/generated/prisma/client";
import type { createPrismaClient } from "@/lib/db";

type DatabaseClient = ReturnType<typeof createPrismaClient>;

export type WhoHasWhatRow = {
  assignmentId: string;
  personId: string;
  assetId: string;
  personName: string;
  grade: number | null;
  groups: string;
  assignmentGroup: string | null;
  assetTag: string;
  category: string;
  assetDescription: string;
  checkedOutAt: string;
  expectedReturnAt: string | null;
  agreementOnFile: number;
};

export type UnassignedAssetRow = {
  assetId: string;
  assetTag: string;
  category: string;
  assetDescription: string;
  condition: string;
  status: string;
  location: string | null;
};

export type OutstandingAssignmentRow = WhoHasWhatRow & {
  daysOverdue: number;
};

export type FlaggedComponentRow = {
  componentId: string;
  assetTag: string;
  assetDescription: string;
  componentName: string;
  componentStatus: string;
  notes: string | null;
};

export type RepairCostByPeriodRow = {
  operatingPeriodId: string;
  periodLabel: string;
  repairCount: number;
  totalCost: number;
};

export type RepairCostByAssetRow = {
  assetId: string;
  assetTag: string;
  assetDescription: string;
  repairCount: number;
  totalCost: number;
};

export type FleetValueRow = {
  assetCount: number;
  totalFleetValue: number;
  assignedAssetCount: number;
  assignedOutValue: number;
};

export function whoHasWhat(db: DatabaseClient, programId: string) {
  return db.$queryRaw<WhoHasWhatRow[]>(Prisma.sql`
    SELECT
      assignment.id AS assignmentId,
      person.id AS personId,
      asset.id AS assetId,
      person.lastName || CASE WHEN person.lastName = '' THEN '' ELSE ', ' END || person.firstName AS personName,
      student.grade AS grade,
      COALESCE((SELECT group_concat(group_record.name, ', ')
        FROM GroupMembership AS membership
        INNER JOIN "Group" AS group_record ON group_record.id = membership.groupId
        WHERE membership.personId = person.id AND membership.endedAt IS NULL), '') AS groups,
      assignment_group.name AS assignmentGroup,
      COALESCE(asset.schoolAssetTag, asset.id) AS assetTag,
      asset.category AS category,
      TRIM(COALESCE(asset.make, '') || ' ' || COALESCE(asset.model, '')) AS assetDescription,
      CAST(assignment.checkedOutAt AS TEXT) AS checkedOutAt,
      CAST(assignment.expectedReturnAt AS TEXT) AS expectedReturnAt,
      assignment.agreementOnFile AS agreementOnFile
    FROM Assignment AS assignment
    INNER JOIN Person AS person ON person.id = assignment.personId
    LEFT JOIN StudentProfile AS student ON student.personId = person.id
    LEFT JOIN "Group" AS assignment_group ON assignment_group.id = assignment.groupId
    INNER JOIN Asset AS asset ON asset.id = assignment.assetId
    WHERE asset.programId = ${programId}
      AND assignment.checkedInAt IS NULL
    ORDER BY person.lastName, person.firstName, asset.schoolAssetTag
  `);
}

export function unassignedAssets(db: DatabaseClient, programId: string) {
  return db.$queryRaw<UnassignedAssetRow[]>(Prisma.sql`
    SELECT
      asset.id AS assetId,
      COALESCE(asset.schoolAssetTag, asset.id) AS assetTag,
      asset.category AS category,
      TRIM(COALESCE(asset.make, '') || ' ' || COALESCE(asset.model, '')) AS assetDescription,
      asset.condition AS condition,
      asset.status AS status,
      asset.location AS location
    FROM Asset AS asset
    WHERE asset.programId = ${programId}
      AND NOT EXISTS (
        SELECT 1
        FROM Assignment AS assignment
        WHERE assignment.assetId = asset.id
          AND assignment.checkedInAt IS NULL
      )
    ORDER BY asset.category, asset.schoolAssetTag
  `);
}

export function outstandingAssignments(db: DatabaseClient, programId: string, asOf = new Date()) {
  const asOfIso = asOf.toISOString();
  return db.$queryRaw<OutstandingAssignmentRow[]>(Prisma.sql`
    SELECT
      assignment.id AS assignmentId,
      person.id AS personId,
      asset.id AS assetId,
      person.lastName || CASE WHEN person.lastName = '' THEN '' ELSE ', ' END || person.firstName AS personName,
      student.grade AS grade,
      COALESCE((SELECT group_concat(group_record.name, ', ')
        FROM GroupMembership AS membership
        INNER JOIN "Group" AS group_record ON group_record.id = membership.groupId
        WHERE membership.personId = person.id AND membership.endedAt IS NULL), '') AS groups,
      assignment_group.name AS assignmentGroup,
      COALESCE(asset.schoolAssetTag, asset.id) AS assetTag,
      asset.category AS category,
      TRIM(COALESCE(asset.make, '') || ' ' || COALESCE(asset.model, '')) AS assetDescription,
      CAST(assignment.checkedOutAt AS TEXT) AS checkedOutAt,
      CAST(assignment.expectedReturnAt AS TEXT) AS expectedReturnAt,
      assignment.agreementOnFile AS agreementOnFile,
      CAST(julianday(${asOfIso}) - julianday(assignment.expectedReturnAt) AS INTEGER) AS daysOverdue
    FROM Assignment AS assignment
    INNER JOIN Person AS person ON person.id = assignment.personId
    LEFT JOIN StudentProfile AS student ON student.personId = person.id
    LEFT JOIN "Group" AS assignment_group ON assignment_group.id = assignment.groupId
    INNER JOIN Asset AS asset ON asset.id = assignment.assetId
    WHERE asset.programId = ${programId}
      AND assignment.checkedInAt IS NULL
      AND assignment.expectedReturnAt IS NOT NULL
      AND assignment.expectedReturnAt < ${asOfIso}
    ORDER BY assignment.expectedReturnAt, person.lastName, person.firstName
  `);
}

export function missingOrDamagedComponents(db: DatabaseClient, programId: string) {
  return db.$queryRaw<FlaggedComponentRow[]>(Prisma.sql`
    SELECT
      component.id AS componentId,
      COALESCE(asset.schoolAssetTag, asset.id) AS assetTag,
      TRIM(COALESCE(asset.make, '') || ' ' || COALESCE(asset.model, '')) AS assetDescription,
      component.name AS componentName,
      component.status AS componentStatus,
      component.notes AS notes
    FROM AssetComponent AS component
    INNER JOIN Asset AS asset ON asset.id = component.assetId
    WHERE asset.programId = ${programId}
      AND component.status IN ('MISSING', 'DAMAGED')
    ORDER BY component.status, asset.schoolAssetTag, component.name
  `);
}

export function repairCostByPeriod(db: DatabaseClient, programId: string) {
  return db.$queryRaw<RepairCostByPeriodRow[]>(Prisma.sql`
    SELECT
      period.id AS operatingPeriodId,
      period.label AS periodLabel,
      COUNT(repair.id) AS repairCount,
      ROUND(SUM(COALESCE(CAST(repair.cost AS REAL), 0)), 2) AS totalCost
    FROM Repair AS repair
    INNER JOIN OperatingPeriod AS period ON period.id = repair.operatingPeriodId
    WHERE period.programId = ${programId}
    GROUP BY period.id, period.label, period.startsAt
    ORDER BY period.startsAt DESC
  `);
}

export function repairCostByAsset(db: DatabaseClient, programId: string) {
  return db.$queryRaw<RepairCostByAssetRow[]>(Prisma.sql`
    SELECT
      asset.id AS assetId,
      COALESCE(asset.schoolAssetTag, asset.id) AS assetTag,
      TRIM(COALESCE(asset.make, '') || ' ' || COALESCE(asset.model, '')) AS assetDescription,
      COUNT(repair.id) AS repairCount,
      ROUND(SUM(COALESCE(CAST(repair.cost AS REAL), 0)), 2) AS totalCost
    FROM Repair AS repair
    INNER JOIN Asset AS asset ON asset.id = repair.assetId
    WHERE asset.programId = ${programId}
    GROUP BY asset.id, asset.schoolAssetTag, asset.make, asset.model
    ORDER BY totalCost DESC, asset.schoolAssetTag
  `);
}

export function fleetValue(db: DatabaseClient, programId: string) {
  return db.$queryRaw<FleetValueRow[]>(Prisma.sql`
    SELECT
      COUNT(asset.id) AS assetCount,
      ROUND(SUM(COALESCE(CAST(asset.estimatedValue AS REAL), 0)), 2) AS totalFleetValue,
      SUM(CASE WHEN EXISTS (
        SELECT 1 FROM Assignment AS assignment
        WHERE assignment.assetId = asset.id AND assignment.checkedInAt IS NULL
      ) THEN 1 ELSE 0 END) AS assignedAssetCount,
      ROUND(SUM(CASE WHEN EXISTS (
        SELECT 1 FROM Assignment AS assignment
        WHERE assignment.assetId = asset.id AND assignment.checkedInAt IS NULL
      ) THEN COALESCE(CAST(asset.estimatedValue AS REAL), 0) ELSE 0 END), 2) AS assignedOutValue
    FROM Asset AS asset
    WHERE asset.programId = ${programId}
  `);
}

export async function allStageTwoReports(db: DatabaseClient, programId: string, asOf = new Date()) {
  const [
    holdings,
    unassigned,
    outstanding,
    flaggedComponents,
    costsByPeriod,
    costsByAsset,
    value,
  ] = await Promise.all([
    whoHasWhat(db, programId),
    unassignedAssets(db, programId),
    outstandingAssignments(db, programId, asOf),
    missingOrDamagedComponents(db, programId),
    repairCostByPeriod(db, programId),
    repairCostByAsset(db, programId),
    fleetValue(db, programId),
  ]);

  return {
    holdings,
    unassigned,
    outstanding,
    flaggedComponents,
    costsByPeriod,
    costsByAsset,
    value,
  };
}
