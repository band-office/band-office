import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AssetCategory,
  AssetStatus,
  FinancialEntryType,
  PersonClassificationType,
} from "@/generated/prisma/client";
import { commitCutTimeMigration, previewCutTimeMigration } from "@/lib/cuttime-migration";
import { commitCutTimeBalanceImport, previewCutTimeBalanceImport } from "@/lib/cuttime-balance-import";
import { commitCutTimeGuardianImport, planCutTimeGuardiansFromMemberExport, previewCutTimeGuardianImport } from "@/lib/cuttime-guardian-import";
import { commitCutTimeLibraryImport, previewCutTimeLibraryImport } from "@/lib/cuttime-library-import";
import type { CutTimeMigrationInput } from "@/lib/cuttime-migration-types";
import { createPrismaClient } from "@/lib/db";

const db = createPrismaClient(process.env.DATABASE_URL);
const programId = "cuttime-migration-program";
const operatingPeriodId = "cuttime-migration-period";
const libraryProgramId = "cuttime-library-import-program";
const guardianProgramId = "cuttime-guardian-import-program";
const guardianReuseProgramId = "cuttime-guardian-reuse-program";
const balanceProgramId = "cuttime-balance-import-program";
const balancePeriodId = "cuttime-balance-import-period";

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
    {
      kind: "library",
      filename: "cuttime-library.xlsx",
      contentHash: "library-sha256",
      headers: ["Title", "Category", "Instrumentation/voicing", "Composer", "Arranger", "Grade", "Storage location", "Barcode", "Library number", "Publisher", "Publisher number", "Copyright year", "Notes", "Performance notes", "Date purchased", "Purchase price", "ID"],
      rows: [
        { Title: "First Suite", Category: "Concert band", "Instrumentation/voicing": "Concert band", Composer: "Gustav Holst", Arranger: "", Grade: "3.5", "Storage location": "Cabinet A", Barcode: "BC-001", "Library number": "LIB-001", Publisher: "Boosey", "Publisher number": "B-101", "Copyright year": "1909", Notes: "Complete set", "Performance notes": "Strong closer", "Date purchased": "45500", "Purchase price": "125.50", ID: "CUT-LIB-1" },
        { Title: "Second Suite", Category: "Concert band", "Instrumentation/voicing": "Concert band", Composer: "Gustav Holst", Arranger: "", Grade: "4", "Storage location": "Cabinet B", Barcode: "BC-002", "Library number": "LIB-002", Publisher: "Boosey", "Publisher number": "B-102", "Copyright year": "1911", Notes: "", "Performance notes": "", "Date purchased": "", "Purchase price": "", ID: "CUT-LIB-2" },
      ],
    },
  ],
};

beforeAll(async () => {
  await db.program.create({ data: { id: programId, name: "CutTime Migration Test Program" } });
  await db.program.create({ data: { id: libraryProgramId, name: "CutTime Library Import Test Program" } });
  await db.program.create({ data: { id: guardianProgramId, name: "CutTime Guardian Import Test Program" } });
  await db.program.create({ data: { id: guardianReuseProgramId, name: "CutTime Guardian Reuse Test Program" } });
  await db.program.create({ data: { id: balanceProgramId, name: "CutTime Balance Import Test Program" } });
  await db.person.createMany({ data: [
    { id: "guardian-student-1", programId: guardianProgramId, firstName: "Avery", lastName: "Student", status: "ACTIVE" },
    { id: "guardian-student-2", programId: guardianProgramId, firstName: "Bailey", lastName: "Student", status: "ACTIVE" },
    { id: "guardian-reuse-student", programId: guardianReuseProgramId, firstName: "Cameron", lastName: "Student", status: "ACTIVE" },
    { id: "guardian-reuse-person", programId: guardianReuseProgramId, firstName: "Jamie", lastName: "Parent", email: "jamie.parent@example.test", phone: "555-0410", status: "ACTIVE" },
    { id: "balance-student-1", programId: balanceProgramId, firstName: "Dana", lastName: "Balance", status: "ACTIVE" },
    { id: "balance-student-2", programId: balanceProgramId, firstName: "Emery", lastName: "Credit", status: "ACTIVE" },
  ] });
  await db.studentProfile.createMany({ data: [
    { personId: "guardian-student-1", programId: guardianProgramId, grade: 7, schoolStudentId: "CT-301" },
    { personId: "guardian-student-2", programId: guardianProgramId, grade: 8, schoolStudentId: "CT-302" },
    { personId: "guardian-reuse-student", programId: guardianReuseProgramId, grade: 6, schoolStudentId: "CT-401" },
    { personId: "balance-student-1", programId: balanceProgramId, grade: 7, schoolStudentId: "CT-501" },
    { personId: "balance-student-2", programId: balanceProgramId, grade: 8, schoolStudentId: "BO-502" },
  ] });
  await db.personClassification.create({ data: { personId: "guardian-reuse-person", classification: PersonClassificationType.GUARDIAN } });
  await db.externalReference.create({ data: { id: "balance-student-2-cuttime-reference", programId: balanceProgramId, source: "CUTTIME", entityType: "Student", sourceId: "CT-502", entityId: "balance-student-2" } });
  await db.operatingPeriod.create({ data: { id: balancePeriodId, programId: balanceProgramId, label: "2026-27", startsAt: new Date("2026-07-01T00:00:00Z"), periodKind: "school_year" } });
  await db.operatingPeriod.create({ data: { id: operatingPeriodId, programId, label: "2026-27", startsAt: new Date("2026-07-01T00:00:00Z"), periodKind: "school_year" } });
});

afterAll(async () => {
  await db.$disconnect();
});

describe.sequential("CutTime migration", () => {
  it("previews an empty-program cutover without persisting source rows", async () => {
    const preview = await previewCutTimeMigration(db, programId, migration);
    expect(preview.ready).toBe(true);
    expect(preview.counts).toEqual({ students: 2, guardians: 1, groups: 4, assets: 3, assignments: 1, openingBalances: 2, libraryItems: 2 });
    expect(preview.warnings).toHaveLength(0);
  });

  it("imports current operations with provenance, audit history, and opening balances", async () => {
    const result = await commitCutTimeMigration(db, { programId, operatingPeriodId, actor: "director", migration });
    expect(result.preview.ready).toBe(true);

    const [students, guardians, groups, assets, assignment, openRepair, financials, libraryItems, run, sourceRows, references, audits] = await Promise.all([
      db.studentProfile.count({ where: { programId } }),
      db.personClassification.count({ where: { classification: PersonClassificationType.GUARDIAN, person: { programId } } }),
      db.group.count({ where: { programId } }),
      db.asset.findMany({ where: { programId }, orderBy: { schoolAssetTag: "asc" }, include: { components: true } }),
      db.assignment.findFirst({ where: { asset: { programId } }, include: { asset: true } }),
      db.repair.findFirst({ where: { asset: { programId }, status: "OPEN" }, include: { asset: true } }),
      db.financialEntry.findMany({ where: { programId }, orderBy: { personId: "asc" } }),
      db.libraryItem.findMany({ where: { programId }, orderBy: { catalogNumber: "asc" } }),
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
    expect(libraryItems.map((item) => [item.title, item.catalogNumber, item.acquisitionCost?.toString() ?? null])).toEqual([["First Suite", "LIB-001", "125.5"], ["Second Suite", "LIB-002", null]]);
    expect(libraryItems[0]?.comments).toContain("Performance notes: Strong closer");
    expect(run.sources).toHaveLength(7);
    expect(sourceRows.every((source) => !source.headersJson.includes("Marlow") && !source.mappingJson.includes("Marlow"))).toBe(true);
    expect(references).toBe(8);
    expect(audits).toBeGreaterThan(8);
  });

  it("blocks a second migration rather than merging over a live program", async () => {
    const preview = await previewCutTimeMigration(db, programId, migration);
    expect(preview.ready).toBe(false);
    expect(preview.errors.some((item) => item.code === "DESTINATION_NOT_EMPTY")).toBe(true);
  });

  it("does not add a second opening-balance sheet after a full CutTime cutover", async () => {
    const preview = await previewCutTimeBalanceImport(db, programId, {
      cutoverDate: "2026-08-02",
      source: {
        kind: "balances",
        filename: "replacement-cuttime-balances.csv",
        contentHash: "replacement-cuttime-balances-sha256",
        headers: ["Student ID", "Student balance"],
        rows: [{ "Student ID": "CT-101", "Student balance": "125.00" }],
      },
    });
    expect(preview.ready).toBe(false);
    expect(preview.errors.some((item) => item.code === "BALANCES_ALREADY_IMPORTED")).toBe(true);
  });

  it("imports a CutTime library into a program that already uses Band Office", async () => {
    const library = {
      source: {
        kind: "library" as const,
        filename: "later-library-export.xlsx",
        contentHash: "later-library-sha256",
        headers: ["Title", "Composer", "Library number", "Storage location", "ID"],
        rows: [{ Title: "Third Suite", Composer: "Robert Jager", "Library number": "LIB-003", "Storage location": "Cabinet C", ID: "CUT-LIB-3" }],
      },
    };
    const preview = await previewCutTimeLibraryImport(db, libraryProgramId, library);
    expect(preview.ready).toBe(true);
    expect(preview.count).toBe(1);
    expect(preview.source.mappedFields).toContain("Library number");

    const result = await commitCutTimeLibraryImport(db, { programId: libraryProgramId, actor: "director", library });
    expect(result.preview.count).toBe(1);
    await expect(previewCutTimeLibraryImport(db, libraryProgramId, library)).resolves.toMatchObject({ ready: false });
    expect(await db.libraryItem.findFirstOrThrow({ where: { programId: libraryProgramId } })).toMatchObject({ title: "Third Suite", catalogNumber: "LIB-003", storageLocation: "Cabinet C", acquisitionSource: "Imported from CutTime" });
    expect(await db.migrationRun.count({ where: { programId: libraryProgramId, source: "CUTTIME_LIBRARY" } })).toBe(1);
  });

  it("creates and reuses guardian records from CutTime's member export", async () => {
    const guardians = {
      source: {
        kind: "students" as const,
        filename: "cuttime-members-with-guardians.xlsx",
        contentHash: "member-guardians-sha256",
        headers: ["Student ID", "Guardian 1 name", "Guardian 1 relationship", "Guardian 1 cell phone", "Guardian 1 email", "Guardian 2 name", "Guardian 2 relationship", "Guardian 2 cell phone", "Guardian 2 email"],
        rows: [
          { "Student ID": "CT-301", "Guardian 1 name": "Alex Parent", "Guardian 1 relationship": "Parent", "Guardian 1 cell phone": "555-0123", "Guardian 1 email": "alex.parent@example.test", "Guardian 2 name": "", "Guardian 2 relationship": "", "Guardian 2 cell phone": "", "Guardian 2 email": "" },
          { "Student ID": "CT-302", "Guardian 1 name": "Alex Parent", "Guardian 1 relationship": "Parent", "Guardian 1 cell phone": "555-0123", "Guardian 1 email": "alex.parent@example.test", "Guardian 2 name": "", "Guardian 2 relationship": "", "Guardian 2 cell phone": "", "Guardian 2 email": "" },
        ],
      },
    };
    const preview = await previewCutTimeGuardianImport(db, guardianProgramId, guardians);
    expect(preview.ready).toBe(true);
    expect(preview.counts).toEqual({ guardians: 1, links: 2, existingGuardians: 0 });

    await commitCutTimeGuardianImport(db, { programId: guardianProgramId, actor: "director", guardians });
    expect(await db.personClassification.count({ where: { classification: PersonClassificationType.GUARDIAN, person: { programId: guardianProgramId } } })).toBe(1);
    expect(await db.guardianStudent.count({ where: { guardian: { programId: guardianProgramId } } })).toBe(2);
    await expect(previewCutTimeGuardianImport(db, guardianProgramId, guardians)).resolves.toMatchObject({ ready: false });
  });

  it("does not create duplicate family links from repeated member-export rows", () => {
    const plan = planCutTimeGuardiansFromMemberExport({
      kind: "students",
      filename: "duplicated-member-export.csv",
      contentHash: "duplicated-member-export-sha256",
      headers: ["Student ID", "Guardian 1 name", "Guardian 1 email"],
      rows: [
        { "Student ID": "CT-301", "Guardian 1 name": "Alex Parent", "Guardian 1 email": "alex.parent@example.test" },
        { "Student ID": "CT-301", "Guardian 1 name": "Alex Parent", "Guardian 1 email": "alex.parent@example.test" },
      ],
    });

    expect(plan.errors).toHaveLength(0);
    expect(plan.guardians).toHaveLength(1);
    expect(plan.warnings.some((warning) => warning.code === "DUPLICATE_GUARDIAN_LINK")).toBe(true);
  });

  it("keeps guardians distinct when they share a household email address", () => {
    const plan = planCutTimeGuardiansFromMemberExport({
      kind: "students",
      filename: "shared-household-email.csv",
      contentHash: "shared-household-email-sha256",
      headers: ["Student ID", "Guardian 1 name", "Guardian 1 email", "Guardian 2 name", "Guardian 2 email"],
      rows: [{ "Student ID": "CT-301", "Guardian 1 name": "Alex Parent", "Guardian 1 email": "household@example.test", "Guardian 2 name": "Bailey Parent", "Guardian 2 email": "household@example.test" }],
    });

    expect(plan.errors).toHaveLength(0);
    expect(new Set(plan.guardians.map((guardian) => guardian.sourceId))).toHaveLength(2);
  });

  it("reuses a matching guardian that was already entered in Band Office", async () => {
    const guardians = {
      source: {
        kind: "students" as const,
        filename: "member-export-with-existing-guardian.csv",
        contentHash: "member-existing-guardian-sha256",
        headers: ["Student ID", "Guardian 1 name", "Guardian 1 relationship", "Guardian 1 cell phone", "Guardian 1 email"],
        rows: [{ "Student ID": "CT-401", "Guardian 1 name": "Jamie Parent", "Guardian 1 relationship": "Parent", "Guardian 1 cell phone": "555-0410", "Guardian 1 email": "jamie.parent@example.test" }],
      },
    };
    const preview = await previewCutTimeGuardianImport(db, guardianReuseProgramId, guardians);
    expect(preview).toMatchObject({ ready: true, counts: { guardians: 0, links: 1, existingGuardians: 1 } });

    await commitCutTimeGuardianImport(db, { programId: guardianReuseProgramId, actor: "director", guardians });
    expect(await db.personClassification.count({ where: { classification: PersonClassificationType.GUARDIAN, person: { programId: guardianReuseProgramId } } })).toBe(1);
    expect(await db.guardianStudent.count({ where: { guardianId: "guardian-reuse-person", studentId: "guardian-reuse-student" } })).toBe(1);
  });

  it("imports positive CutTime balances as charges and negative balances as credits once", async () => {
    const balances = {
      cutoverDate: "2026-08-02",
      source: {
        kind: "balances" as const,
        filename: "cuttime-student-balances.csv",
        contentHash: "cuttime-student-balances-sha256",
        headers: ["Student ID", "Student balance"],
        rows: [
          { "Student ID": "CT-501", "Student balance": "42.75" },
          { "Student ID": "CT-502", "Student balance": "(12.50)" },
          { "Student ID": "CT-503", "Student balance": "0.00" },
        ],
      },
    };
    const preview = await previewCutTimeBalanceImport(db, balanceProgramId, balances);
    expect(preview).toMatchObject({ ready: true, counts: { charges: 1, credits: 1, zeroBalances: 1 } });

    await commitCutTimeBalanceImport(db, { programId: balanceProgramId, operatingPeriodId: balancePeriodId, actor: "director", balances });
    const entries = await db.financialEntry.findMany({ where: { programId: balanceProgramId }, orderBy: { personId: "asc" } });
    expect(entries.map((entry) => [entry.type, entry.amount.toString()])).toEqual([[FinancialEntryType.CHARGE, "42.75"], [FinancialEntryType.CREDIT, "-12.5"]]);
    await expect(previewCutTimeBalanceImport(db, balanceProgramId, balances)).resolves.toMatchObject({ ready: false });
  });
});
