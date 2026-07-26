import { randomUUID } from "node:crypto";
import {
  AssetCategory,
  AssetCondition,
  AssetStatus,
  AssignmentResolution,
  ComponentStatus,
  GroupKind,
  OperatingPeriodStatus,
  PersonClassificationType,
  PersonStatus,
  Prisma,
  RepairStatus,
} from "@/generated/prisma/client";
import type { createPrismaClient } from "@/lib/db";

type DatabaseClient = ReturnType<typeof createPrismaClient>;
type TransactionClient = Prisma.TransactionClient;

export class InventoryInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryInvariantError";
  }
}

type AuditInput = {
  programId: string;
  actor: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "CHECKOUT" | "CHECKIN" | "ROLLOVER" | "IMPORT";
  entityType: string;
  entityId: string;
  summary: string;
  fields?: string[];
};

async function appendAudit(tx: TransactionClient, input: AuditInput) {
  await tx.auditLog.create({
    data: {
      id: randomUUID(),
      programId: input.programId,
      actor: input.actor,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      changeSummary: input.summary,
      changeDiffJson: input.fields
        ? JSON.stringify({ fields: input.fields, values: "[redacted]" })
        : null,
    },
  });
}

async function assetProgramId(tx: TransactionClient, assetId: string) {
  const asset = await tx.asset.findUniqueOrThrow({
    where: { id: assetId },
    select: { programId: true },
  });
  return asset.programId;
}

async function syncAssetStatus(tx: TransactionClient, assetId: string, actor: string) {
  const asset = await tx.asset.findUniqueOrThrow({
    where: { id: assetId },
    select: { id: true, programId: true, status: true },
  });

  if (asset.status === AssetStatus.RETIRED || asset.status === AssetStatus.MISSING) {
    return;
  }

  const [activeAssignments, openRepairs] = await Promise.all([
    tx.assignment.count({ where: { assetId, checkedInAt: null } }),
    tx.repair.count({
      where: { assetId, status: { in: [RepairStatus.OPEN, RepairStatus.AT_VENDOR] } },
    }),
  ]);

  const nextStatus = activeAssignments > 0
    ? AssetStatus.ASSIGNED
    : openRepairs > 0
      ? AssetStatus.IN_REPAIR
      : AssetStatus.AVAILABLE;

  if (nextStatus !== asset.status) {
    await tx.asset.update({ where: { id: assetId }, data: { status: nextStatus } });
    await appendAudit(tx, {
      programId: asset.programId,
      actor,
      action: "UPDATE",
      entityType: "Asset",
      entityId: assetId,
      summary: "Synchronized asset lifecycle status",
      fields: ["status"],
    });
  }
}

export async function createProgram(db: DatabaseClient, input: { id?: string; name: string }, actor: string) {
  return db.$transaction(async (tx) => {
    const program = await tx.program.create({
      data: { id: input.id ?? randomUUID(), name: input.name },
    });
    await appendAudit(tx, {
      programId: program.id,
      actor,
      action: "CREATE",
      entityType: "Program",
      entityId: program.id,
      summary: "Created program record",
      fields: ["name"],
    });
    return program;
  });
}

export async function updateProgram(db: DatabaseClient, id: string, name: string, actor: string) {
  return db.$transaction(async (tx) => {
    const program = await tx.program.update({ where: { id }, data: { name } });
    await appendAudit(tx, {
      programId: id,
      actor,
      action: "UPDATE",
      entityType: "Program",
      entityId: id,
      summary: "Updated program record",
      fields: ["name"],
    });
    return program;
  });
}

export async function updateProgramSettings(
  db: DatabaseClient,
  id: string,
  data: { name?: string; graduationGrade?: number; agreementTemplate?: string | null },
  actor: string,
) {
  return db.$transaction(async (tx) => {
    const program = await tx.program.update({ where: { id }, data });
    await appendAudit(tx, {
      programId: id,
      actor,
      action: "UPDATE",
      entityType: "Program",
      entityId: id,
      summary: "Updated program settings",
      fields: Object.keys(data),
    });
    return program;
  });
}

type PersonCreateInput = {
  id?: string;
  programId: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  status?: PersonStatus;
  notes?: string | null;
  classifications: PersonClassificationType[];
  student?: { grade: number; schoolStudentId?: string | null };
  groupIds?: string[];
};

type PersonUpdateInput = Partial<Pick<PersonCreateInput, "firstName" | "lastName" | "email" | "phone" | "status" | "notes">> & {
  student?: { grade: number; schoolStudentId?: string | null } | null;
};

export async function createPerson(db: DatabaseClient, input: PersonCreateInput, actor: string) {
  return db.$transaction(async (tx) => {
    const id = input.id ?? randomUUID();
    const person = await tx.person.create({
      data: {
        id,
        programId: input.programId,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        status: input.status ?? PersonStatus.ACTIVE,
        notes: input.notes,
      },
    });
    const classifications = [...new Set(input.classifications)];
    if (!classifications.length) throw new InventoryInvariantError("Select at least one person classification.");
    await tx.personClassification.createMany({ data: classifications.map((classification) => ({ personId: id, classification })) });
    if (classifications.includes(PersonClassificationType.STUDENT)) {
      if (!input.student || !Number.isInteger(input.student.grade)) throw new InventoryInvariantError("Students require a grade.");
      await tx.studentProfile.create({ data: { personId: id, programId: input.programId, ...input.student } });
    }
    for (const groupId of [...new Set(input.groupIds ?? [])]) {
      const group = await tx.group.findUniqueOrThrow({ where: { id: groupId } });
      if (group.programId !== input.programId) throw new InventoryInvariantError("People and groups must belong to one program.");
      await tx.groupMembership.create({ data: { id: randomUUID(), personId: id, groupId } });
    }
    await appendAudit(tx, {
      programId: person.programId,
      actor,
      action: "CREATE",
      entityType: "Person",
      entityId: person.id,
      summary: "Created person record",
      fields: ["firstName", "lastName", "email", "phone", "status", "notes", "classifications", "student", "groupIds"],
    });
    return person;
  });
}

export async function updatePerson(db: DatabaseClient, id: string, data: PersonUpdateInput, actor: string) {
  return db.$transaction(async (tx) => {
    const existing = await tx.person.findUniqueOrThrow({ where: { id }, include: { portalUser: true } });
    const { student, ...personData } = data;
    const person = await tx.person.update({ where: { id }, data: personData });
    if (existing.portalUser && Object.prototype.hasOwnProperty.call(personData, "email")) {
      if (person.email?.trim()) {
        await tx.portalUser.update({
          where: { id: existing.portalUser.id },
          data: { emailNormalized: person.email.trim().toLowerCase() },
        });
      } else {
        await tx.portalSession.deleteMany({ where: { userId: existing.portalUser.id } });
        await tx.portalUser.update({
          where: { id: existing.portalUser.id },
          data: { status: "DISABLED" },
        });
      }
    }
    if (student) {
      await tx.studentProfile.upsert({
        where: { personId: id },
        update: student,
        create: { personId: id, programId: existing.programId, ...student },
      });
      await tx.personClassification.upsert({
        where: { personId_classification: { personId: id, classification: PersonClassificationType.STUDENT } },
        update: {},
        create: { personId: id, classification: PersonClassificationType.STUDENT },
      });
    }
    await appendAudit(tx, {
      programId: existing.programId,
      actor,
      action: "UPDATE",
      entityType: "Person",
      entityId: id,
      summary: "Updated person record",
      fields: Object.keys(data),
    });
    return person;
  });
}

export async function deletePerson(db: DatabaseClient, id: string, actor: string) {
  return db.$transaction(async (tx) => {
    const existing = await tx.person.findUniqueOrThrow({ where: { id } });
    const person = await tx.person.delete({ where: { id } });
    await appendAudit(tx, {
      programId: existing.programId,
      actor,
      action: "DELETE",
      entityType: "Person",
      entityId: id,
      summary: "Deleted unreferenced person record",
    });
    return person;
  });
}

export async function addPersonClassification(db: DatabaseClient, personId: string, classification: PersonClassificationType, actor: string) {
  return db.$transaction(async (tx) => {
    const person = await tx.person.findUniqueOrThrow({ where: { id: personId } });
    const record = await tx.personClassification.upsert({
      where: { personId_classification: { personId, classification } },
      update: {},
      create: { personId, classification },
    });
    await appendAudit(tx, { programId: person.programId, actor, action: "UPDATE", entityType: "Person", entityId: personId, summary: "Added person classification", fields: ["classifications"] });
    return record;
  });
}

export async function createGroup(db: DatabaseClient, input: { id?: string; programId: string; name: string; kind: GroupKind; description?: string | null }, actor: string) {
  return db.$transaction(async (tx) => {
    if (!input.name.trim()) throw new InventoryInvariantError("Group name is required.");
    const group = await tx.group.create({ data: { ...input, id: input.id ?? randomUUID(), name: input.name.trim() } });
    await appendAudit(tx, { programId: input.programId, actor, action: "CREATE", entityType: "Group", entityId: group.id, summary: "Created group", fields: ["name", "kind", "description"] });
    return group;
  });
}

export async function updateGroup(db: DatabaseClient, id: string, data: { name?: string; kind?: GroupKind; description?: string | null; active?: boolean }, actor: string) {
  return db.$transaction(async (tx) => {
    const existing = await tx.group.findUniqueOrThrow({ where: { id } });
    const group = await tx.group.update({ where: { id }, data });
    await appendAudit(tx, { programId: existing.programId, actor, action: "UPDATE", entityType: "Group", entityId: id, summary: "Updated group", fields: Object.keys(data) });
    return group;
  });
}

export async function addGroupMembership(db: DatabaseClient, input: { groupId: string; personId: string; roleLabel?: string | null }, actor: string) {
  return db.$transaction(async (tx) => {
    const [group, person] = await Promise.all([tx.group.findUniqueOrThrow({ where: { id: input.groupId } }), tx.person.findUniqueOrThrow({ where: { id: input.personId } })]);
    if (group.programId !== person.programId) throw new InventoryInvariantError("People and groups must belong to one program.");
    const membership = await tx.groupMembership.upsert({
      where: { groupId_personId: { groupId: input.groupId, personId: input.personId } },
      update: { endedAt: null, roleLabel: input.roleLabel },
      create: { id: randomUUID(), ...input },
    });
    await appendAudit(tx, { programId: group.programId, actor, action: "UPDATE", entityType: "Group", entityId: group.id, summary: "Added person to group", fields: ["memberships"] });
    return membership;
  });
}

export async function endGroupMembership(db: DatabaseClient, id: string, actor: string) {
  return db.$transaction(async (tx) => {
    const existing = await tx.groupMembership.findUniqueOrThrow({ where: { id }, include: { group: true } });
    const membership = await tx.groupMembership.update({ where: { id }, data: { endedAt: new Date() } });
    await appendAudit(tx, { programId: existing.group.programId, actor, action: "UPDATE", entityType: "Group", entityId: existing.groupId, summary: "Ended group membership", fields: ["memberships"] });
    return membership;
  });
}

export async function linkGuardianStudent(db: DatabaseClient, input: { guardianId: string; studentId: string; relationshipLabel?: string | null; primaryContact?: boolean; receivesCommunication?: boolean }, actor: string) {
  return db.$transaction(async (tx) => {
    if (input.guardianId === input.studentId) throw new InventoryInvariantError("A person cannot be their own guardian.");
    const [guardian, student] = await Promise.all([tx.person.findUniqueOrThrow({ where: { id: input.guardianId } }), tx.person.findUniqueOrThrow({ where: { id: input.studentId }, include: { studentProfile: true } })]);
    if (guardian.programId !== student.programId || !student.studentProfile) throw new InventoryInvariantError("Guardian and student must belong to one program, and the student must have a student profile.");
    await tx.personClassification.upsert({ where: { personId_classification: { personId: guardian.id, classification: PersonClassificationType.GUARDIAN } }, update: {}, create: { personId: guardian.id, classification: PersonClassificationType.GUARDIAN } });
    const link = await tx.guardianStudent.upsert({
      where: { guardianId_studentId: { guardianId: guardian.id, studentId: student.id } },
      update: { relationshipLabel: input.relationshipLabel, primaryContact: input.primaryContact ?? false, receivesCommunication: input.receivesCommunication ?? true },
      create: { id: randomUUID(), ...input },
    });
    await appendAudit(tx, { programId: student.programId, actor, action: "UPDATE", entityType: "Person", entityId: student.id, summary: "Linked guardian and student", fields: ["guardianLinks"] });
    return link;
  });
}

export async function createGuardianAndLinkStudent(db: DatabaseClient, input: {
  studentId: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  relationshipLabel?: string | null;
  primaryContact?: boolean;
  receivesCommunication?: boolean;
}, actor: string) {
  return db.$transaction(async (tx) => {
    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();
    const email = input.email?.trim() || null;
    const phone = input.phone?.trim() || null;
    if (!firstName || !lastName) throw new InventoryInvariantError("Guardian first and last name are required.");
    if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)) throw new InventoryInvariantError("Enter a valid guardian email address.");

    const student = await tx.person.findUniqueOrThrow({ where: { id: input.studentId }, include: { studentProfile: true } });
    if (!student.studentProfile) throw new InventoryInvariantError("Guardian relationships can be created only for students.");

    if (email) {
      const normalizedEmail = email.toLowerCase();
      const possibleDuplicates = await tx.person.findMany({
        where: { programId: student.programId, email: { not: null } },
        select: { id: true, firstName: true, lastName: true, email: true },
      });
      const duplicate = possibleDuplicates.find((person) => person.email?.trim().toLowerCase() === normalizedEmail);
      if (duplicate) throw new InventoryInvariantError(`${duplicate.firstName} ${duplicate.lastName} already uses that email. Search for and link the existing person instead.`);
    }

    const guardianId = randomUUID();
    const guardian = await tx.person.create({
      data: {
        id: guardianId,
        programId: student.programId,
        firstName,
        lastName,
        email,
        phone,
        status: PersonStatus.ACTIVE,
      },
    });
    await tx.personClassification.create({ data: { personId: guardianId, classification: PersonClassificationType.GUARDIAN } });
    const link = await tx.guardianStudent.create({
      data: {
        id: randomUUID(),
        guardianId,
        studentId: student.id,
        relationshipLabel: input.relationshipLabel?.trim() || null,
        primaryContact: input.primaryContact ?? false,
        receivesCommunication: input.receivesCommunication ?? true,
      },
    });
    await appendAudit(tx, {
      programId: student.programId,
      actor,
      action: "CREATE",
      entityType: "Person",
      entityId: guardian.id,
      summary: "Created guardian from student relationship",
      fields: ["firstName", "lastName", "email", "phone", "classifications"],
    });
    await appendAudit(tx, {
      programId: student.programId,
      actor,
      action: "UPDATE",
      entityType: "Person",
      entityId: student.id,
      summary: "Linked newly created guardian and student",
      fields: ["guardianLinks"],
    });
    return { guardian, link };
  });
}

export async function unlinkGuardianStudent(db: DatabaseClient, id: string, actor: string) {
  return db.$transaction(async (tx) => {
    const existing = await tx.guardianStudent.findUniqueOrThrow({ where: { id }, include: { student: true } });
    await tx.guardianStudent.delete({ where: { id } });
    await appendAudit(tx, { programId: existing.student.programId, actor, action: "UPDATE", entityType: "Person", entityId: existing.studentId, summary: "Removed guardian and student link", fields: ["guardianLinks"] });
  });
}

type AssetCreateInput = {
  id?: string;
  programId: string;
  category: AssetCategory;
  make?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  schoolAssetTag?: string | null;
  size?: string | null;
  condition: AssetCondition;
  status?: AssetStatus;
  purchaseYear?: number | null;
  estimatedValue?: number | string | null;
  location?: string | null;
  notes?: string | null;
};

type AssetUpdateInput = Partial<Omit<AssetCreateInput, "id" | "programId" | "category">> & {
  category?: AssetCategory;
};

export async function createAsset(db: DatabaseClient, input: AssetCreateInput, actor: string) {
  const initialStatus = input.status ?? AssetStatus.AVAILABLE;
  if (initialStatus === AssetStatus.ASSIGNED || initialStatus === AssetStatus.IN_REPAIR) {
    throw new InventoryInvariantError("Assigned and in-repair states must come from lifecycle records.");
  }

  return db.$transaction(async (tx) => {
    const asset = await tx.asset.create({
      data: { ...input, id: input.id ?? randomUUID(), status: initialStatus },
    });
    await appendAudit(tx, {
      programId: asset.programId,
      actor,
      action: "CREATE",
      entityType: "Asset",
      entityId: asset.id,
      summary: "Created asset record",
      fields: Object.keys(input).filter((field) => field !== "programId"),
    });
    return asset;
  });
}

export async function updateAsset(db: DatabaseClient, id: string, data: AssetUpdateInput, actor: string) {
  return db.$transaction(async (tx) => {
    const existing = await tx.asset.findUniqueOrThrow({ where: { id } });

    if (data.status === AssetStatus.RETIRED || data.status === AssetStatus.MISSING) {
      const activeAssignments = await tx.assignment.count({ where: { assetId: id, checkedInAt: null } });
      if (activeAssignments > 0) {
        throw new InventoryInvariantError("An assigned asset cannot be retired or marked missing.");
      }
    }

    const asset = await tx.asset.update({ where: { id }, data });
    await appendAudit(tx, {
      programId: existing.programId,
      actor,
      action: "UPDATE",
      entityType: "Asset",
      entityId: id,
      summary: "Updated asset record",
      fields: Object.keys(data),
    });

    if (data.status === AssetStatus.AVAILABLE) {
      await syncAssetStatus(tx, id, actor);
      return tx.asset.findUniqueOrThrow({ where: { id } });
    }

    return asset;
  });
}

export async function deleteAsset(db: DatabaseClient, id: string, actor: string) {
  return db.$transaction(async (tx) => {
    const existing = await tx.asset.findUniqueOrThrow({
      where: { id },
      include: { components: true },
    });

    for (const component of existing.components) {
      await tx.assetComponent.delete({ where: { id: component.id } });
      await appendAudit(tx, {
        programId: existing.programId,
        actor,
        action: "DELETE",
        entityType: "AssetComponent",
        entityId: component.id,
        summary: "Deleted component with unreferenced asset",
      });
    }

    const asset = await tx.asset.delete({ where: { id } });
    await appendAudit(tx, {
      programId: existing.programId,
      actor,
      action: "DELETE",
      entityType: "Asset",
      entityId: id,
      summary: "Deleted unreferenced asset record",
    });
    return asset;
  });
}

type ComponentInput = {
  id?: string;
  assetId: string;
  name: string;
  status?: ComponentStatus;
  notes?: string | null;
};

export async function createAssetComponent(db: DatabaseClient, input: ComponentInput, actor: string) {
  return db.$transaction(async (tx) => {
    const programId = await assetProgramId(tx, input.assetId);
    const component = await tx.assetComponent.create({
      data: { ...input, id: input.id ?? randomUUID() },
    });
    await appendAudit(tx, {
      programId,
      actor,
      action: "CREATE",
      entityType: "AssetComponent",
      entityId: component.id,
      summary: "Created attached component record",
      fields: Object.keys(input).filter((field) => field !== "assetId"),
    });
    return component;
  });
}

export async function updateAssetComponent(
  db: DatabaseClient,
  id: string,
  data: Partial<Pick<ComponentInput, "name" | "status" | "notes">>,
  actor: string,
) {
  return db.$transaction(async (tx) => {
    const existing = await tx.assetComponent.findUniqueOrThrow({ where: { id } });
    const programId = await assetProgramId(tx, existing.assetId);
    const component = await tx.assetComponent.update({ where: { id }, data });
    await appendAudit(tx, {
      programId,
      actor,
      action: "UPDATE",
      entityType: "AssetComponent",
      entityId: id,
      summary: "Updated attached component record",
      fields: Object.keys(data),
    });
    return component;
  });
}

export async function deleteAssetComponent(db: DatabaseClient, id: string, actor: string) {
  return db.$transaction(async (tx) => {
    const existing = await tx.assetComponent.findUniqueOrThrow({ where: { id } });
    const programId = await assetProgramId(tx, existing.assetId);
    const component = await tx.assetComponent.delete({ where: { id } });
    await appendAudit(tx, {
      programId,
      actor,
      action: "DELETE",
      entityType: "AssetComponent",
      entityId: id,
      summary: "Deleted attached component record",
    });
    return component;
  });
}

type PeriodCreateInput = {
  id?: string;
  programId: string;
  label: string;
  startsAt: Date;
  endsAt?: Date | null;
  periodKind: string;
  status?: OperatingPeriodStatus;
  archivePath?: string | null;
};

export async function createOperatingPeriod(db: DatabaseClient, input: PeriodCreateInput, actor: string) {
  return db.$transaction(async (tx) => {
    const period = await tx.operatingPeriod.create({
      data: { ...input, id: input.id ?? randomUUID() },
    });
    await appendAudit(tx, {
      programId: period.programId,
      actor,
      action: "CREATE",
      entityType: "OperatingPeriod",
      entityId: period.id,
      summary: "Created operating period",
      fields: Object.keys(input).filter((field) => field !== "programId"),
    });
    return period;
  });
}

export async function updateOperatingPeriod(
  db: DatabaseClient,
  id: string,
  data: Partial<Omit<PeriodCreateInput, "id" | "programId">>,
  actor: string,
) {
  return db.$transaction(async (tx) => {
    const existing = await tx.operatingPeriod.findUniqueOrThrow({ where: { id } });
    const period = await tx.operatingPeriod.update({ where: { id }, data });
    await appendAudit(tx, {
      programId: existing.programId,
      actor,
      action: "UPDATE",
      entityType: "OperatingPeriod",
      entityId: id,
      summary: "Updated operating period",
      fields: Object.keys(data),
    });
    return period;
  });
}

export async function deleteOperatingPeriod(db: DatabaseClient, id: string, actor: string) {
  return db.$transaction(async (tx) => {
    const existing = await tx.operatingPeriod.findUniqueOrThrow({ where: { id } });
    const period = await tx.operatingPeriod.delete({ where: { id } });
    await appendAudit(tx, {
      programId: existing.programId,
      actor,
      action: "DELETE",
      entityType: "OperatingPeriod",
      entityId: id,
      summary: "Deleted unreferenced operating period",
    });
    return period;
  });
}

type CheckoutInput = {
  id?: string;
  assetId: string;
  personId: string;
  groupId?: string | null;
  operatingPeriodId: string;
  checkedOutAt: Date;
  expectedReturnAt?: Date | null;
  conditionOut: AssetCondition;
  agreementOnFile?: boolean;
  notes?: string | null;
};

export async function checkoutAsset(db: DatabaseClient, input: CheckoutInput, actor: string) {
  return db.$transaction(async (tx) => {
    const [asset, person, period, group] = await Promise.all([
      tx.asset.findUniqueOrThrow({ where: { id: input.assetId } }),
      tx.person.findUniqueOrThrow({ where: { id: input.personId } }),
      tx.operatingPeriod.findUniqueOrThrow({ where: { id: input.operatingPeriodId } }),
      input.groupId ? tx.group.findUniqueOrThrow({ where: { id: input.groupId } }) : null,
    ]);

    if (asset.programId !== person.programId || asset.programId !== period.programId || (group && group.programId !== asset.programId)) {
      throw new InventoryInvariantError("Asset, person, group, and operating period must belong to one program.");
    }
    if (person.status !== PersonStatus.ACTIVE) {
      throw new InventoryInvariantError("Assets can only be assigned to active people.");
    }
    if (group) {
      const membership = await tx.groupMembership.findUnique({ where: { groupId_personId: { groupId: group.id, personId: person.id } } });
      if (!membership || membership.endedAt) throw new InventoryInvariantError("The selected person is not an active member of that group.");
    }
    if (asset.status === AssetStatus.RETIRED || asset.status === AssetStatus.MISSING) {
      throw new InventoryInvariantError("Retired and missing assets cannot be checked out.");
    }
    if (period.status !== OperatingPeriodStatus.OPEN) {
      throw new InventoryInvariantError("New assignments require an open operating period.");
    }

    const [activeAssignments, openRepairs] = await Promise.all([
      tx.assignment.count({ where: { assetId: asset.id, checkedInAt: null } }),
      tx.repair.count({
        where: { assetId: asset.id, status: { in: [RepairStatus.OPEN, RepairStatus.AT_VENDOR] } },
      }),
    ]);
    if (activeAssignments > 0) {
      throw new InventoryInvariantError("Asset already has an active assignment.");
    }
    if (openRepairs > 0) {
      throw new InventoryInvariantError("Asset with an open repair cannot be checked out.");
    }

    const assignment = await tx.assignment.create({
      data: { ...input, id: input.id ?? randomUUID() },
    });
    await appendAudit(tx, {
      programId: asset.programId,
      actor,
      action: "CHECKOUT",
      entityType: "Assignment",
      entityId: assignment.id,
      summary: "Checked out asset",
      fields: ["assetId", "personId", "groupId", "operatingPeriodId", "checkedOutAt", "expectedReturnAt", "conditionOut", "agreementOnFile"],
    });
    await syncAssetStatus(tx, asset.id, actor);
    return assignment;
  });
}

export async function updateAssignment(
  db: DatabaseClient,
  id: string,
  data: Partial<Pick<CheckoutInput, "expectedReturnAt" | "agreementOnFile" | "notes">>,
  actor: string,
) {
  return db.$transaction(async (tx) => {
    const existing = await tx.assignment.findUniqueOrThrow({
      where: { id },
      include: { asset: { select: { programId: true } } },
    });
    const assignment = await tx.assignment.update({ where: { id }, data });
    await appendAudit(tx, {
      programId: existing.asset.programId,
      actor,
      action: "UPDATE",
      entityType: "Assignment",
      entityId: id,
      summary: "Updated assignment record",
      fields: Object.keys(data),
    });
    return assignment;
  });
}

export async function checkinAsset(
  db: DatabaseClient,
  id: string,
  input: { checkedInAt: Date; conditionIn: AssetCondition; resolution?: AssignmentResolution; notes?: string | null },
  actor: string,
) {
  return db.$transaction(async (tx) => {
    const existing = await tx.assignment.findUniqueOrThrow({
      where: { id },
      include: { asset: { select: { programId: true } } },
    });
    if (existing.checkedInAt) {
      throw new InventoryInvariantError("Assignment is already closed.");
    }

    const assignment = await tx.assignment.update({
      where: { id },
      data: {
        checkedInAt: input.checkedInAt,
        conditionIn: input.conditionIn,
        resolution: input.resolution ?? AssignmentResolution.RETURNED,
        notes: input.notes,
      },
    });
    await appendAudit(tx, {
      programId: existing.asset.programId,
      actor,
      action: "CHECKIN",
      entityType: "Assignment",
      entityId: id,
      summary: "Checked in asset",
      fields: ["checkedInAt", "conditionIn", "resolution", "notes"],
    });
    await syncAssetStatus(tx, existing.assetId, actor);
    return assignment;
  });
}

export async function checkinAssetWithOptionalRepair(
  db: DatabaseClient,
  id: string,
  input: {
    checkedInAt: Date;
    conditionIn: AssetCondition;
    resolution?: AssignmentResolution;
    notes?: string | null;
    repair?: { description: string; vendor?: string | null; cost?: number | string | null };
  },
  actor: string,
) {
  return db.$transaction(async (tx) => {
    const existing = await tx.assignment.findUniqueOrThrow({
      where: { id },
      include: { asset: { select: { programId: true } } },
    });
    if (existing.checkedInAt) throw new InventoryInvariantError("Assignment is already closed.");

    const assignment = await tx.assignment.update({
      where: { id },
      data: {
        checkedInAt: input.checkedInAt,
        conditionIn: input.conditionIn,
        resolution: input.resolution ?? AssignmentResolution.RETURNED,
        notes: input.notes,
      },
    });
    await appendAudit(tx, {
      programId: existing.asset.programId,
      actor,
      action: "CHECKIN",
      entityType: "Assignment",
      entityId: id,
      summary: "Checked in asset",
      fields: ["checkedInAt", "conditionIn", "resolution", "notes"],
    });

    let repair = null;
    if (input.repair) {
      repair = await tx.repair.create({
        data: {
          id: randomUUID(),
          assetId: existing.assetId,
          operatingPeriodId: existing.operatingPeriodId,
          openedAt: input.checkedInAt,
          description: input.repair.description,
          vendor: input.repair.vendor,
          cost: input.repair.cost,
          status: RepairStatus.OPEN,
        },
      });
      await appendAudit(tx, {
        programId: existing.asset.programId,
        actor,
        action: "CREATE",
        entityType: "Repair",
        entityId: repair.id,
        summary: "Opened repair from check-in inspection",
        fields: ["openedAt", "description", "vendor", "cost", "status"],
      });
    }

    await syncAssetStatus(tx, existing.assetId, actor);
    return { assignment, repair };
  });
}

export async function deleteAssignment(db: DatabaseClient, id: string, actor: string) {
  return db.$transaction(async (tx) => {
    const existing = await tx.assignment.findUniqueOrThrow({
      where: { id },
      include: { asset: { select: { programId: true } } },
    });
    const assignment = await tx.assignment.delete({ where: { id } });
    await appendAudit(tx, {
      programId: existing.asset.programId,
      actor,
      action: "DELETE",
      entityType: "Assignment",
      entityId: id,
      summary: "Deleted assignment record",
    });
    await syncAssetStatus(tx, existing.assetId, actor);
    return assignment;
  });
}

type RepairCreateInput = {
  id?: string;
  assetId: string;
  operatingPeriodId: string;
  openedAt: Date;
  description: string;
  vendor?: string | null;
  cost?: number | string | null;
  closedAt?: Date | null;
  status?: RepairStatus;
};

export async function createRepair(db: DatabaseClient, input: RepairCreateInput, actor: string) {
  return db.$transaction(async (tx) => {
    const [asset, period] = await Promise.all([
      tx.asset.findUniqueOrThrow({ where: { id: input.assetId } }),
      tx.operatingPeriod.findUniqueOrThrow({ where: { id: input.operatingPeriodId } }),
    ]);
    if (asset.programId !== period.programId) {
      throw new InventoryInvariantError("Asset and repair period must belong to one program.");
    }
    if (asset.status === AssetStatus.RETIRED || asset.status === AssetStatus.MISSING) {
      throw new InventoryInvariantError("Retired and missing assets cannot enter repair.");
    }
    const activeAssignments = await tx.assignment.count({ where: { assetId: asset.id, checkedInAt: null } });
    if (activeAssignments > 0) {
      throw new InventoryInvariantError("Check in an assigned asset before opening a repair.");
    }

    const repair = await tx.repair.create({
      data: { ...input, id: input.id ?? randomUUID() },
    });
    await appendAudit(tx, {
      programId: asset.programId,
      actor,
      action: "CREATE",
      entityType: "Repair",
      entityId: repair.id,
      summary: "Created repair record",
      fields: Object.keys(input).filter((field) => field !== "assetId"),
    });
    await syncAssetStatus(tx, asset.id, actor);
    return repair;
  });
}

export async function rolloverOperatingPeriod(
  db: DatabaseClient,
  input: { programId: string; currentPeriodId: string; nextLabel: string; nextStartsAt: Date },
  actor: string,
) {
  return db.$transaction(async (tx) => {
    const [program, currentPeriod, outstanding, latestBackup, latestMutation] = await Promise.all([
      tx.program.findUniqueOrThrow({ where: { id: input.programId } }),
      tx.operatingPeriod.findUniqueOrThrow({ where: { id: input.currentPeriodId } }),
      tx.assignment.count({ where: { operatingPeriodId: input.currentPeriodId, checkedInAt: null } }),
      tx.backupRecord.findFirst({ where: { programId: input.programId }, orderBy: { createdAt: "desc" } }),
      tx.auditLog.findFirst({
        where: { programId: input.programId, action: { not: "EXPORT" } },
        orderBy: { timestamp: "desc" },
      }),
    ]);
    if (currentPeriod.status !== OperatingPeriodStatus.OPEN) throw new InventoryInvariantError("Only an open period can roll over.");
    if (outstanding > 0) throw new InventoryInvariantError(`${outstanding} assignments remain open.`);
    if (!latestBackup || (latestMutation && latestBackup.createdAt < latestMutation.timestamp)) {
      throw new InventoryInvariantError("Create a fresh full backup after the latest record change before rollover.");
    }
    if (!input.nextLabel.trim()) throw new InventoryInvariantError("The next period label is required.");

    const activeStudents = await tx.person.findMany({ where: { programId: input.programId, status: PersonStatus.ACTIVE, studentProfile: { isNot: null } }, include: { studentProfile: true } });
    let promoted = 0;
    let graduated = 0;
    for (const student of activeStudents) {
      const profile = student.studentProfile!;
      const graduating = profile.grade >= program.graduationGrade;
      if (graduating) {
        await tx.person.update({ where: { id: student.id }, data: { status: PersonStatus.GRADUATED } });
        await tx.groupMembership.updateMany({ where: { personId: student.id, endedAt: null }, data: { endedAt: new Date() } });
      } else {
        await tx.studentProfile.update({ where: { personId: student.id }, data: { grade: profile.grade + 1 } });
      }
      await appendAudit(tx, {
        programId: input.programId,
        actor,
        action: "ROLLOVER",
        entityType: "Person",
        entityId: student.id,
        summary: graduating ? "Graduated student during period rollover" : "Advanced student grade during period rollover",
        fields: graduating ? ["status"] : ["grade"],
      });
      if (graduating) graduated += 1;
      else promoted += 1;
    }

    const closedAt = new Date();
    await tx.operatingPeriod.update({
      where: { id: currentPeriod.id },
      data: { status: OperatingPeriodStatus.CLOSED, endsAt: currentPeriod.endsAt ?? closedAt, archivePath: latestBackup.filename },
    });
    await appendAudit(tx, {
      programId: input.programId,
      actor,
      action: "ROLLOVER",
      entityType: "OperatingPeriod",
      entityId: currentPeriod.id,
      summary: "Closed operating period after verified backup",
      fields: ["status", "endsAt", "archivePath"],
    });

    const nextPeriod = await tx.operatingPeriod.create({
      data: {
        id: randomUUID(),
        programId: input.programId,
        label: input.nextLabel.trim(),
        startsAt: input.nextStartsAt,
        periodKind: currentPeriod.periodKind,
        status: OperatingPeriodStatus.OPEN,
      },
    });
    await appendAudit(tx, {
      programId: input.programId,
      actor,
      action: "ROLLOVER",
      entityType: "OperatingPeriod",
      entityId: nextPeriod.id,
      summary: "Opened next operating period",
      fields: ["label", "startsAt", "periodKind", "status"],
    });
    return { nextPeriod, promoted, graduated, backupFilename: latestBackup.filename };
  });
}

export async function updateRepair(
  db: DatabaseClient,
  id: string,
  data: Partial<Omit<RepairCreateInput, "id" | "assetId" | "operatingPeriodId">>,
  actor: string,
) {
  return db.$transaction(async (tx) => {
    const existing = await tx.repair.findUniqueOrThrow({
      where: { id },
      include: { asset: { select: { programId: true } } },
    });
    const repair = await tx.repair.update({ where: { id }, data });
    await appendAudit(tx, {
      programId: existing.asset.programId,
      actor,
      action: "UPDATE",
      entityType: "Repair",
      entityId: id,
      summary: "Updated repair record",
      fields: Object.keys(data),
    });
    await syncAssetStatus(tx, existing.assetId, actor);
    return repair;
  });
}

export async function deleteRepair(db: DatabaseClient, id: string, actor: string) {
  return db.$transaction(async (tx) => {
    const existing = await tx.repair.findUniqueOrThrow({
      where: { id },
      include: { asset: { select: { programId: true } } },
    });
    const repair = await tx.repair.delete({ where: { id } });
    await appendAudit(tx, {
      programId: existing.asset.programId,
      actor,
      action: "DELETE",
      entityType: "Repair",
      entityId: id,
      summary: "Deleted repair record",
    });
    await syncAssetStatus(tx, existing.assetId, actor);
    return repair;
  });
}

export type StudentImportRow = {
  firstName: string;
  lastName: string;
  grade: number;
  section: string;
  schoolStudentId?: string | null;
};

export async function importStudents(db: DatabaseClient, programId: string, rows: StudentImportRow[], actor: string) {
  return db.$transaction(async (tx) => {
    let created = 0;
    let updated = 0;
    for (const [index, row] of rows.entries()) {
      if (!row.firstName || !row.lastName || !Number.isFinite(row.grade) || !row.section) {
        throw new InventoryInvariantError(`Roster row ${index + 1} is missing a required value.`);
      }
      const profile = row.schoolStudentId
        ? await tx.studentProfile.findUnique({ where: { programId_schoolStudentId: { programId, schoolStudentId: row.schoolStudentId } }, include: { person: true } })
        : await tx.studentProfile.findFirst({ where: { programId, grade: row.grade, person: { firstName: row.firstName, lastName: row.lastName } }, include: { person: true } });
      const sectionName = row.section.trim().toLowerCase();
      const group = await tx.group.upsert({
        where: { programId_name: { programId, name: sectionName } },
        update: { active: true },
        create: { id: randomUUID(), programId, name: sectionName, kind: GroupKind.SECTION },
      });
      if (profile) {
        await tx.person.update({ where: { id: profile.personId }, data: { firstName: row.firstName, lastName: row.lastName, status: PersonStatus.ACTIVE } });
        await tx.studentProfile.update({ where: { personId: profile.personId }, data: { grade: row.grade, schoolStudentId: row.schoolStudentId } });
        await tx.personClassification.upsert({ where: { personId_classification: { personId: profile.personId, classification: PersonClassificationType.STUDENT } }, update: {}, create: { personId: profile.personId, classification: PersonClassificationType.STUDENT } });
        await tx.groupMembership.upsert({ where: { groupId_personId: { groupId: group.id, personId: profile.personId } }, update: { endedAt: null }, create: { id: randomUUID(), groupId: group.id, personId: profile.personId } });
        await appendAudit(tx, { programId, actor, action: "IMPORT", entityType: "Person", entityId: profile.personId, summary: "Updated student from roster import", fields: Object.keys(row) });
        updated++;
      } else {
        const person = await tx.person.create({ data: { id: randomUUID(), programId, firstName: row.firstName, lastName: row.lastName, status: PersonStatus.ACTIVE } });
        await tx.studentProfile.create({ data: { personId: person.id, programId, grade: row.grade, schoolStudentId: row.schoolStudentId } });
        await tx.personClassification.create({ data: { personId: person.id, classification: PersonClassificationType.STUDENT } });
        await tx.groupMembership.create({ data: { id: randomUUID(), groupId: group.id, personId: person.id } });
        await appendAudit(tx, { programId, actor, action: "IMPORT", entityType: "Person", entityId: person.id, summary: "Created student from roster import", fields: Object.keys(row) });
        created++;
      }
    }
    return { created, updated };
  });
}

export type AssetImportRow = {
  category: AssetCategory;
  schoolAssetTag: string;
  make?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  size?: string | null;
  condition: AssetCondition;
  purchaseYear?: number | null;
  estimatedValue?: number | null;
  location?: string | null;
};

export async function importAssets(db: DatabaseClient, programId: string, rows: AssetImportRow[], actor: string) {
  return db.$transaction(async (tx) => {
    let created = 0;
    let updated = 0;
    for (const [index, row] of rows.entries()) {
      if (!row.schoolAssetTag || !Object.values(AssetCategory).includes(row.category) || !Object.values(AssetCondition).includes(row.condition)) {
        throw new InventoryInvariantError(`Asset row ${index + 1} has an invalid tag, category, or condition.`);
      }
      const existing = await tx.asset.findUnique({ where: { programId_schoolAssetTag: { programId, schoolAssetTag: row.schoolAssetTag } } });
      if (existing) {
        await tx.asset.update({ where: { id: existing.id }, data: row });
        await appendAudit(tx, { programId, actor, action: "IMPORT", entityType: "Asset", entityId: existing.id, summary: "Updated asset from inventory import", fields: Object.keys(row) });
        updated++;
      } else {
        const asset = await tx.asset.create({ data: { ...row, id: randomUUID(), programId, status: AssetStatus.AVAILABLE } });
        await appendAudit(tx, { programId, actor, action: "IMPORT", entityType: "Asset", entityId: asset.id, summary: "Created asset from inventory import", fields: Object.keys(row) });
        created++;
      }
    }
    return { created, updated };
  });
}
