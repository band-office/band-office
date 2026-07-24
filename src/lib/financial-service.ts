import { randomUUID } from "node:crypto";
import {
  FinancialEntryType,
  PersonStatus,
  Prisma,
} from "@/generated/prisma/client";
import type { createPrismaClient } from "@/lib/db";

type DatabaseClient = ReturnType<typeof createPrismaClient>;
type TransactionClient = Prisma.TransactionClient;

export class FinancialInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FinancialInvariantError";
  }
}

function positiveMoney(value: string | number | Prisma.Decimal) {
  let amount: Prisma.Decimal;
  try {
    amount = new Prisma.Decimal(value);
  } catch {
    throw new FinancialInvariantError("Enter a valid monetary amount.");
  }
  if (!amount.isFinite() || amount.lte(0)) throw new FinancialInvariantError("Amount must be greater than zero.");
  if (amount.decimalPlaces() > 2) throw new FinancialInvariantError("Amount cannot have more than two decimal places.");
  return amount;
}

function requireDescription(value: string) {
  const description = value.trim();
  if (!description) throw new FinancialInvariantError("Description is required.");
  return description;
}

async function verifyPeriod(tx: TransactionClient, operatingPeriodId: string, programId: string) {
  const period = await tx.operatingPeriod.findUniqueOrThrow({ where: { id: operatingPeriodId } });
  if (period.programId !== programId) throw new FinancialInvariantError("The financial entry and operating period must belong to one program.");
}

async function verifyStudent(tx: TransactionClient, personId: string, programId: string) {
  const person = await tx.person.findUniqueOrThrow({ where: { id: personId }, include: { studentProfile: true } });
  if (person.programId !== programId || !person.studentProfile) throw new FinancialInvariantError("Financial accounts are available only for students in this program.");
  return person;
}

async function verifyGroupContext(tx: TransactionClient, groupId: string | null | undefined, personId: string, programId: string) {
  if (!groupId) return;
  const group = await tx.group.findUniqueOrThrow({ where: { id: groupId } });
  if (group.programId !== programId) throw new FinancialInvariantError("The financial entry and group must belong to one program.");
  const membership = await tx.groupMembership.findFirst({ where: { groupId, personId, endedAt: null } });
  if (!membership) throw new FinancialInvariantError("The student is not an active member of that group.");
}

async function appendFinancialAudit(tx: TransactionClient, input: {
  programId: string;
  actor: string;
  action: "POST" | "REVERSE";
  entityType: "FinancialEntry" | "FinancialBatch";
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

export async function postFinancialEntry(db: DatabaseClient, input: {
  id?: string;
  programId: string;
  personId: string;
  operatingPeriodId: string;
  groupId?: string | null;
  type: Exclude<FinancialEntryType, "REVERSAL">;
  amount: string | number | Prisma.Decimal;
  occurredAt: Date;
  dueDate?: Date | null;
  description: string;
  reference?: string | null;
}, actor: string) {
  if (![FinancialEntryType.CHARGE, FinancialEntryType.PAYMENT, FinancialEntryType.CREDIT].includes(input.type)) {
    throw new FinancialInvariantError("Reversals can only be created from an existing ledger entry.");
  }
  const enteredAmount = positiveMoney(input.amount);
  const amount = input.type === FinancialEntryType.CHARGE ? enteredAmount : enteredAmount.negated();
  const description = requireDescription(input.description);

  return db.$transaction(async (tx) => {
    await verifyPeriod(tx, input.operatingPeriodId, input.programId);
    await verifyStudent(tx, input.personId, input.programId);
    await verifyGroupContext(tx, input.groupId, input.personId, input.programId);
    const entry = await tx.financialEntry.create({
      data: {
        id: input.id ?? randomUUID(),
        programId: input.programId,
        personId: input.personId,
        operatingPeriodId: input.operatingPeriodId,
        groupId: input.groupId,
        type: input.type,
        amount,
        occurredAt: input.occurredAt,
        dueDate: input.type === FinancialEntryType.CHARGE ? input.dueDate : null,
        description,
        reference: input.reference?.trim() || null,
        createdBy: actor,
      },
    });
    await appendFinancialAudit(tx, {
      programId: input.programId,
      actor,
      action: "POST",
      entityType: "FinancialEntry",
      entityId: entry.id,
      summary: `Posted ${input.type.toLowerCase()} to student account`,
      fields: ["personId", "operatingPeriodId", "groupId", "type", "amount", "occurredAt", "dueDate", "description", "reference"],
    });
    return entry;
  });
}

export async function postGroupAssessment(db: DatabaseClient, input: {
  id?: string;
  programId: string;
  operatingPeriodId: string;
  groupId: string;
  amount: string | number | Prisma.Decimal;
  occurredAt: Date;
  dueDate?: Date | null;
  description: string;
}, actor: string) {
  const amount = positiveMoney(input.amount);
  const description = requireDescription(input.description);

  return db.$transaction(async (tx) => {
    await verifyPeriod(tx, input.operatingPeriodId, input.programId);
    const group = await tx.group.findUniqueOrThrow({
      where: { id: input.groupId },
      include: {
        memberships: {
          where: { endedAt: null, person: { status: PersonStatus.ACTIVE, studentProfile: { isNot: null } } },
          select: { personId: true },
        },
      },
    });
    if (group.programId !== input.programId || !group.active) throw new FinancialInvariantError("Choose an active group in this program.");
    if (!group.memberships.length) throw new FinancialInvariantError("That group has no active student members to assess.");

    const batchId = input.id ?? randomUUID();
    const batch = await tx.financialBatch.create({
      data: {
        id: batchId,
        programId: input.programId,
        operatingPeriodId: input.operatingPeriodId,
        groupId: input.groupId,
        description,
        amount,
        occurredAt: input.occurredAt,
        dueDate: input.dueDate,
        createdBy: actor,
      },
    });
    await appendFinancialAudit(tx, {
      programId: input.programId,
      actor,
      action: "POST",
      entityType: "FinancialBatch",
      entityId: batch.id,
      summary: `Posted group assessment to ${group.memberships.length} student accounts`,
      fields: ["operatingPeriodId", "groupId", "description", "amount", "occurredAt", "dueDate", "studentCount"],
    });

    const entries = group.memberships.map((membership) => ({
      id: randomUUID(),
      programId: input.programId,
      personId: membership.personId,
      operatingPeriodId: input.operatingPeriodId,
      groupId: input.groupId,
      batchId,
      type: FinancialEntryType.CHARGE,
      amount,
      occurredAt: input.occurredAt,
      dueDate: input.dueDate,
      description,
      reference: null,
      createdBy: actor,
    }));
    await tx.financialEntry.createMany({ data: entries });
    await tx.auditLog.createMany({
      data: entries.map((entry) => ({
        id: randomUUID(),
        programId: input.programId,
        actor,
        action: "POST",
        entityType: "FinancialEntry",
        entityId: entry.id,
        changeSummary: "Posted charge from group assessment",
        changeDiffJson: JSON.stringify({ fields: ["personId", "groupId", "batchId", "type", "amount", "occurredAt", "dueDate", "description"], values: "[redacted]" }),
      })),
    });
    return { batch, studentCount: entries.length };
  });
}

export async function reverseFinancialEntry(db: DatabaseClient, entryId: string, occurredAt: Date, reason: string, actor: string) {
  const reversalReason = requireDescription(reason);
  return db.$transaction(async (tx) => {
    const original = await tx.financialEntry.findUniqueOrThrow({
      where: { id: entryId },
      include: { reversedBy: true },
    });
    if (original.type === FinancialEntryType.REVERSAL || original.reversalOfId) throw new FinancialInvariantError("A reversal entry cannot be reversed again.");
    if (original.reversedBy) throw new FinancialInvariantError("This ledger entry has already been reversed.");
    const reversal = await tx.financialEntry.create({
      data: {
        id: randomUUID(),
        programId: original.programId,
        personId: original.personId,
        operatingPeriodId: original.operatingPeriodId,
        groupId: original.groupId,
        type: FinancialEntryType.REVERSAL,
        amount: original.amount.negated(),
        occurredAt,
        description: `Reversal: ${original.description}`,
        reference: reversalReason,
        reversalOfId: original.id,
        createdBy: actor,
      },
    });
    await appendFinancialAudit(tx, {
      programId: original.programId,
      actor,
      action: "REVERSE",
      entityType: "FinancialEntry",
      entityId: reversal.id,
      summary: "Reversed financial ledger entry",
      fields: ["personId", "operatingPeriodId", "groupId", "type", "amount", "occurredAt", "description", "reference", "reversalOfId"],
    });
    return reversal;
  });
}
