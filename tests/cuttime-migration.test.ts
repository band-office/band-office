import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AssetCategory,
  AssetStatus,
  FinancialEntryType,
  PersonClassificationType,
} from "@/generated/prisma/client";
import { commitCutTimeMigration, previewCutTimeMigration } from "@/lib/cuttime-migration";
import type { CutTimeMigrationInput } from "@/lib/cuttime-migration-types";
import { createPrismaClient } from "@/lib/db";

const db = createPrismaClient(process.env.DATABASE_URL);
const programId = "cuttime-migration-program";
const operatingPeriodId = "cuttime-migration-period";

const migration: CutTimeMigrationInput = {
  cutoverDate: "2026-08-02",
  sources: [
    {
      kind: "students",
      filename: "cuttime-members.csv",
      contentHash: "members-sha256",
      headers: ["Student ID", "First Name", "Last Name", "Grade", "Primary Position", "Groups", "Email"],
      rows: [
        { "Student ID": "CT-101", "First Name": "Marlow", "Last Name": "Tenby", Grade: "7", "Primary Position": "Trumpet", Groups: "Wind Ensemble; Jazz Band", Email: "marlow@example.test" },
        { "Student ID": "CT-102", "First Name": "Petra", "Last Name": "Voss", Grade: "6", "Primary Position": "Clarinet", Groups: "Wind Ensemble", Email: "petra@example.test" },
      ],
    },
    {
      kind: "guardians",
      filename: "cuttime-guardians.csv",
      contentHash: "guardians-sha256",
      headers: ["Guardian ID", "Student ID", "First Name", "Last Name", "Email", "Relationship", "Primary Contact"],
      rows: [
        { "Guardian ID": "G-1", "Student ID": "CT-101", "First Name": "Alex", "Last Name": "Tenby", Email: "alex@example.test", Relationship: "Parent", "Primary Contact": "yes" },
        { "Guardian ID": "G-1", "Student ID": "CT-102", "First Name": "Alex", "Last Name": "Tenby", Email: "alex@example.test", Relationship: "Parent", "Primary Contact": "yes" },
      ],
    },
    {
      kind: "instruments",
      filename: "cuttime-instruments.csv",
      contentHash: "instruments-sha256",
      headers: ["Instrument ID", "Asset Tag", "Make", "Model", "Condition", "Assigned Student ID", "Components", "Missing Parts", "Estimated Value"],
      rows: [
        { "Instrument ID": "I-1", "Asset Tag": "CUT-INS-001", Make: "Yamaha", Model: "YTR-2330", Condition: "good", "Assigned Student ID": "CT-101", Components: "Mouthpiece;Case", "Missing Parts": "Lyre", "Estimated Value": "1150.00" },
      ],
    },
    {
      kind: "attire",
      filename: "cuttime-attire.csv",
      contentHash: "attire-sha256",
      headers: ["Attire ID", "Asset Tag", "Size", "Condition"],
      rows: [{ "Attire ID": "A-1", "Asset Tag": "CUT-UNI-001", Size: "38R", Condition: "fair" }],
    },
    {
      kind: "equipment",
      filename: "cuttime-equipment.csv",
      contentHash: "equipment-sha256",
      headers: ["Equipment ID", "Asset Tag", "Status", "Repair Description"],
      rows: [{ "Equipment ID": "E-1", "Asset Tag": "CUT-EQP-001", Status: "in repair", "Repair Description": "Wheel replacement" }],
    },
    {
      kind: "balances",
      filename: "cuttime-balances.csv",
      contentHash: "balances-sha256",
      headers: ["Student ID", "Balance"],
      rows: [{ "Student ID": "CT-101", Balance: "125.00" }, { "Student ID": "CT-102", Balance: "(10.00)" }],
    },
  ],
};

beforeAll(async () => {
  await db.program.create({ data: { id: programId, name: "CutTime Migration Test Program" } });
  await db.operatingPeriod.create({ data: { id: operatingPeriodId, programId, label: "2026-27", startsAt: new Date("2026-07-01T00:00:00Z"), periodKind: "school_year" } });
});

afterAll(async () => {
  await db.$disconnect();
});

describe.sequential("CutTime migration", () => {
  it("previews an empty-program cutover without persisting source rows", async () => {
    const preview = await previewCutTimeMigration(db, programId, migration);
    expect(preview.ready).toBe(true);
    expect(preview.counts).toEqual({ students: 2, guardians: 1, groups: 4, assets: 3, assignments: 1, openingBalances: 2 });
    expect(preview.warnings).toHaveLength(0);
  });

  it("imports current operations with provenance, audit history, and opening balances", async () => {
    const result = await commitCutTimeMigration(db, { programId, operatingPeriodId, actor: "director", migration });
    expect(result.preview.ready).toBe(true);

    const [students, guardians, groups, assets, assignment, openRepair, financials, run, sourceRows, references, audits] = await Promise.all([
      db.studentProfile.count({ where: { programId } }),
      db.personClassification.count({ where: { classification: PersonClassificationType.GUARDIAN, person: { programId } } }),
      db.group.count({ where: { programId } }),
      db.asset.findMany({ where: { programId }, orderBy: { schoolAssetTag: "asc" }, include: { components: true } }),
      db.assignment.findFirst({ where: { asset: { programId } }, include: { asset: true } }),
      db.repair.findFirst({ where: { asset: { programId }, status: "OPEN" }, include: { asset: true } }),
      db.financialEntry.findMany({ where: { programId }, orderBy: { personId: "asc" } }),
      db.migrationRun.findUniqueOrThrow({ where: { id: result.runId }, include: { sources: true } }),
      db.migrationSource.findMany({ where: { migrationRunId: result.runId } }),
      db.externalReference.count({ where: { programId, source: "CUTTIME" } }),
      db.auditLog.count({ where: { programId, action: "MIGRATE" } }),
    ]);

    expect(students).toBe(2);
    expect(guardians).toBe(1);
    expect(groups).toBe(4);
    expect(assets.map((asset) => asset.category)).toEqual([AssetCategory.EQUIPMENT, AssetCategory.INSTRUMENT, AssetCategory.UNIFORM]);
    expect(assets.find((asset) => asset.schoolAssetTag === "CUT-INS-001")?.components.map((component) => `${component.name}:${component.status}`).sort()).toEqual(["Case:PRESENT", "Lyre:MISSING", "Mouthpiece:PRESENT"]);
    expect(assignment?.asset.schoolAssetTag).toBe("CUT-INS-001");
    expect(openRepair?.asset.schoolAssetTag).toBe("CUT-EQP-001");
    expect(openRepair?.asset.status).toBe(AssetStatus.IN_REPAIR);
    expect(financials.map((entry) => [entry.type, entry.amount.toString()]).sort()).toEqual([[FinancialEntryType.CHARGE, "125"], [FinancialEntryType.CREDIT, "-10"]]);
    expect(run.sources).toHaveLength(6);
    expect(sourceRows.every((source) => !source.headersJson.includes("Marlow") && !source.mappingJson.includes("Marlow"))).toBe(true);
    expect(references).toBe(6);
    expect(audits).toBeGreaterThan(8);
  });

  it("blocks a second migration rather than merging over a live program", async () => {
    const preview = await previewCutTimeMigration(db, programId, migration);
    expect(preview.ready).toBe(false);
    expect(preview.errors.some((item) => item.code === "DESTINATION_NOT_EMPTY")).toBe(true);
  });
});
