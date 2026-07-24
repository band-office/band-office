import { createHash, randomUUID } from "node:crypto";
import {
  AnnouncementRecipientStatus,
  AnnouncementStatus,
  CommunicationJobStatus,
  DeliveryAttemptStatus,
  EmailAudienceRecipientKind,
  EmailAudienceTargetType,
  EmailConnectionStatus,
  EmailContactStatus,
  EmailProviderKind,
  PersonClassificationType,
  PersonStatus,
  Prisma,
} from "@/generated/prisma/client";
import type { createPrismaClient } from "@/lib/db";
import { deliverEmail, transportError, verifyEmailConnection } from "@/lib/email-transport";

type DatabaseClient = ReturnType<typeof createPrismaClient>;
type TransactionClient = Prisma.TransactionClient;

export type AudienceTargetInput = {
  targetType: EmailAudienceTargetType;
  recipientKind: EmailAudienceRecipientKind;
  classification?: PersonClassificationType | null;
  groupId?: string | null;
  grade?: number | null;
  personId?: string | null;
};

export type AnnouncementAttachmentInput = {
  fileName: string;
  mimeType: string;
  content: Uint8Array;
};

export type CreateAnnouncementInput = {
  programId: string;
  operatingPeriodId: string;
  subject: string;
  body: string;
  scheduledAt?: Date | null;
  targets: AudienceTargetInput[];
  attachments: AnnouncementAttachmentInput[];
};

export class CommunicationInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommunicationInvariantError";
  }
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function clean(value: string, label: string, max: number) {
  const result = value.trim();
  if (!result) throw new CommunicationInvariantError(`${label} is required.`);
  if (result.length > max) throw new CommunicationInvariantError(`${label} cannot exceed ${max.toLocaleString()} characters.`);
  return result;
}

function auditData(fields: string[]) {
  return JSON.stringify({ fields, values: "[redacted]" });
}

function displayName(person: { firstName: string; lastName: string }) {
  return `${person.firstName} ${person.lastName}`.trim();
}

export async function saveEmailConnection(db: DatabaseClient, input: {
  programId: string;
  provider: EmailProviderKind;
  fromName: string;
  fromAddress: string;
  replyTo?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpSecure: boolean;
  authUsername?: string | null;
  credentialReference?: string | null;
}, actor: string) {
  if (input.provider !== EmailProviderKind.SMTP) throw new CommunicationInvariantError("Google and Microsoft OAuth setup is not available in this connector yet. Choose standard SMTP.");
  const fromAddress = normalizeEmail(input.fromAddress);
  if (!validEmail(fromAddress)) throw new CommunicationInvariantError("Enter a valid shared-mailbox address.");
  const replyTo = input.replyTo ? normalizeEmail(input.replyTo) : null;
  if (replyTo && !validEmail(replyTo)) throw new CommunicationInvariantError("Enter a valid reply-to address.");
  if (!input.smtpHost?.trim()) throw new CommunicationInvariantError("SMTP host is required.");
  if (!Number.isInteger(input.smtpPort) || input.smtpPort! < 1 || input.smtpPort! > 65535) throw new CommunicationInvariantError("SMTP port must be between 1 and 65535.");
  return db.$transaction(async (tx) => {
    const connection = await tx.emailConnection.upsert({
      where: { programId: input.programId },
      update: {
        provider: input.provider,
        status: EmailConnectionStatus.CONFIGURED,
        fromName: clean(input.fromName, "Sender name", 120),
        fromAddress,
        replyTo,
        smtpHost: input.smtpHost!.trim(),
        smtpPort: input.smtpPort,
        smtpSecure: input.smtpSecure,
        authUsername: input.authUsername?.trim() || null,
        credentialReference: input.credentialReference || "BANDOS_SMTP_PASSWORD",
        lastVerifiedAt: null,
        lastError: null,
      },
      create: {
        id: randomUUID(),
        programId: input.programId,
        provider: input.provider,
        status: EmailConnectionStatus.CONFIGURED,
        fromName: clean(input.fromName, "Sender name", 120),
        fromAddress,
        replyTo,
        smtpHost: input.smtpHost!.trim(),
        smtpPort: input.smtpPort!,
        smtpSecure: input.smtpSecure,
        authUsername: input.authUsername?.trim() || null,
        credentialReference: input.credentialReference || "BANDOS_SMTP_PASSWORD",
      },
    });
    await tx.auditLog.create({ data: { id: randomUUID(), programId: input.programId, actor, action: "UPSERT", entityType: "EmailConnection", entityId: connection.id, changeSummary: "Updated shared mailbox connection settings", changeDiffJson: auditData(["provider", "fromName", "fromAddress", "replyTo", "smtpHost", "smtpPort", "smtpSecure", "authUsername"]) } });
    return connection;
  });
}

export async function testEmailConnection(db: DatabaseClient, programId: string, actor: string) {
  const connection = await db.emailConnection.findUnique({ where: { programId } });
  if (!connection) throw new CommunicationInvariantError("Save the shared mailbox settings first.");
  try {
    await verifyEmailConnection(connection);
    return await db.$transaction(async (tx) => {
      const verified = await tx.emailConnection.update({ where: { id: connection.id }, data: { status: EmailConnectionStatus.VERIFIED, lastVerifiedAt: new Date(), lastError: null } });
      await tx.auditLog.create({ data: { id: randomUUID(), programId, actor, action: "VERIFY", entityType: "EmailConnection", entityId: connection.id, changeSummary: "Verified shared mailbox connection" } });
      return verified;
    });
  } catch (error) {
    const detail = transportError(error);
    await db.emailConnection.update({ where: { id: connection.id }, data: { status: EmailConnectionStatus.ERROR, lastError: detail.message } });
    throw new CommunicationInvariantError(`Connection verification failed: ${detail.message}`);
  }
}

export async function saveEmailTemplate(db: DatabaseClient, input: { programId: string; name: string; subject: string; body: string }, actor: string) {
  return db.$transaction(async (tx) => {
    const template = await tx.emailTemplate.create({ data: { id: randomUUID(), programId: input.programId, name: clean(input.name, "Template name", 120), subject: clean(input.subject, "Subject", 200), body: clean(input.body, "Message", 50_000), createdBy: actor } });
    await tx.auditLog.create({ data: { id: randomUUID(), programId: input.programId, actor, action: "CREATE", entityType: "EmailTemplate", entityId: template.id, changeSummary: "Created email template", changeDiffJson: auditData(["name", "subject", "body"]) } });
    return template;
  });
}

export async function updateEmailContactState(db: DatabaseClient, input: { programId: string; email: string; status: EmailContactStatus; reason?: string | null }, actor: string) {
  const emailNormalized = normalizeEmail(input.email);
  if (!validEmail(emailNormalized)) throw new CommunicationInvariantError("Enter a valid email address.");
  return db.$transaction(async (tx) => {
    const state = await tx.emailContactState.upsert({
      where: { programId_emailNormalized: { programId: input.programId, emailNormalized } },
      update: { status: input.status, reason: input.reason?.trim() || null, updatedBy: actor },
      create: { id: randomUUID(), programId: input.programId, emailNormalized, status: input.status, reason: input.reason?.trim() || null, updatedBy: actor },
    });
    await tx.auditLog.create({ data: { id: randomUUID(), programId: input.programId, actor, action: "UPDATE", entityType: "EmailContactState", entityId: state.id, changeSummary: "Updated email contact state", changeDiffJson: auditData(["emailNormalized", "status", "reason"]) } });
    return state;
  });
}

type Candidate = {
  personId: string;
  name: string;
  email: string | null;
  reason: string;
  permitted: boolean;
};

async function basePeople(tx: TransactionClient, programId: string, target: AudienceTargetInput) {
  const active = PersonStatus.ACTIVE;
  if (target.targetType === EmailAudienceTargetType.CLASSIFICATION && target.classification) {
    return tx.person.findMany({ where: { programId, status: active, classifications: { some: { classification: target.classification } } }, include: { studentProfile: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] });
  }
  if (target.targetType === EmailAudienceTargetType.GROUP && target.groupId) {
    const memberships = await tx.groupMembership.findMany({ where: { groupId: target.groupId, endedAt: null, person: { programId, status: active } }, include: { person: { include: { studentProfile: true } }, group: true } });
    return memberships.map((membership) => ({ ...membership.person, targetLabel: membership.group.name }));
  }
  if (target.targetType === EmailAudienceTargetType.GRADE && target.grade) {
    return tx.person.findMany({ where: { programId, status: active, studentProfile: { grade: target.grade } }, include: { studentProfile: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] });
  }
  if (target.targetType === EmailAudienceTargetType.PERSON && target.personId) {
    const person = await tx.person.findFirst({ where: { id: target.personId, programId, status: active }, include: { studentProfile: true } });
    return person ? [person] : [];
  }
  throw new CommunicationInvariantError("An audience target is incomplete.");
}

function targetLabel(target: AudienceTargetInput, people: unknown[]) {
  if (target.targetType === EmailAudienceTargetType.CLASSIFICATION) return target.classification?.toLowerCase().replaceAll("_", " ") || "classification";
  if (target.targetType === EmailAudienceTargetType.GROUP) return (people[0] as { targetLabel?: string } | undefined)?.targetLabel || "group";
  if (target.targetType === EmailAudienceTargetType.GRADE) return `grade ${target.grade}`;
  return "selected contact";
}

async function candidatesForTarget(tx: TransactionClient, programId: string, target: AudienceTargetInput): Promise<Candidate[]> {
  const people = await basePeople(tx, programId, target);
  const label = targetLabel(target, people);
  if (target.recipientKind === EmailAudienceRecipientKind.SELF) {
    if (target.targetType === EmailAudienceTargetType.CLASSIFICATION && target.classification === PersonClassificationType.GUARDIAN) {
      const guardianIds = people.map((person) => person.id);
      const links = guardianIds.length ? await tx.guardianStudent.findMany({ where: { guardianId: { in: guardianIds } } }) : [];
      const permitted = new Set(links.filter((link) => link.receivesCommunication).map((link) => link.guardianId));
      return people.map((person) => ({ personId: person.id, name: displayName(person), email: person.email, reason: `Included as ${label}`, permitted: permitted.has(person.id) }));
    }
    return people.map((person) => ({ personId: person.id, name: displayName(person), email: person.email, reason: `Included through ${label}`, permitted: true }));
  }

  const students = people.filter((person) => person.studentProfile);
  if (!students.length) return [];
  const studentById = new Map(students.map((student) => [student.id, student]));
  const links = await tx.guardianStudent.findMany({ where: { studentId: { in: students.map((student) => student.id) } }, include: { guardian: true } });
  return links
    .filter((link) => link.guardian.programId === programId && link.guardian.status === PersonStatus.ACTIVE)
    .map((link) => ({
      personId: link.guardianId,
      name: displayName(link.guardian),
      email: link.guardian.email,
      reason: `Guardian for ${displayName(studentById.get(link.studentId)!)} through ${label}`,
      permitted: link.receivesCommunication,
    }));
}

async function replaceAudienceSnapshot(tx: TransactionClient, announcementId: string, programId: string, targets: AudienceTargetInput[]) {
  const candidates = (await Promise.all(targets.map((target) => candidatesForTarget(tx, programId, target)))).flat();
  const contactStates = await tx.emailContactState.findMany({ where: { programId } });
  const stateByEmail = new Map(contactStates.map((state) => [state.emailNormalized, state]));
  const destinations = new Map<string, { email: string | null; normalized: string | null; names: Set<string>; people: Set<string>; reasons: Set<string>; permitted: boolean }>();
  for (const candidate of candidates) {
    const normalized = candidate.email ? normalizeEmail(candidate.email) : null;
    const key = normalized ? `email:${normalized}` : `person:${candidate.personId}:missing`;
    const current = destinations.get(key) ?? { email: candidate.email?.trim() || null, normalized, names: new Set(), people: new Set(), reasons: new Set(), permitted: false };
    current.names.add(candidate.name);
    current.people.add(candidate.personId);
    current.reasons.add(`${candidate.reason}${candidate.permitted ? "" : " (communication disabled for this relationship)"}`);
    current.permitted ||= candidate.permitted;
    destinations.set(key, current);
  }

  await tx.announcementRecipient.deleteMany({ where: { announcementId } });
  for (const [destinationKey, destination] of destinations) {
    const contactState = destination.normalized ? stateByEmail.get(destination.normalized) : null;
    let permissionResult: AnnouncementRecipientStatus = AnnouncementRecipientStatus.ELIGIBLE;
    if (!destination.normalized) permissionResult = AnnouncementRecipientStatus.MISSING_EMAIL;
    else if (!validEmail(destination.normalized)) permissionResult = AnnouncementRecipientStatus.INVALID;
    else if (!destination.permitted) permissionResult = AnnouncementRecipientStatus.SUPPRESSED;
    else if (contactState?.status === EmailContactStatus.DISABLED) permissionResult = AnnouncementRecipientStatus.DISABLED;
    else if (contactState?.status === EmailContactStatus.INVALID) permissionResult = AnnouncementRecipientStatus.INVALID;
    else if (contactState?.status === EmailContactStatus.SUPPRESSED) permissionResult = AnnouncementRecipientStatus.SUPPRESSED;
    await tx.announcementRecipient.create({ data: {
      id: randomUUID(),
      announcementId,
      destinationKey,
      emailSnapshot: destination.email,
      emailNormalized: destination.normalized,
      displayNameSnapshot: destination.names.size === 1 ? [...destination.names][0] : `Shared address (${destination.names.size} contacts)`,
      associatedPersonIdsJson: JSON.stringify([...destination.people]),
      inclusionReasonsJson: JSON.stringify([...destination.reasons]),
      permissionResult,
      status: permissionResult === AnnouncementRecipientStatus.ELIGIBLE ? AnnouncementRecipientStatus.PENDING : permissionResult,
    } });
  }
  return destinations.size;
}

function validateTarget(target: AudienceTargetInput) {
  if (target.targetType === EmailAudienceTargetType.CLASSIFICATION && !target.classification) return false;
  if (target.targetType === EmailAudienceTargetType.GROUP && !target.groupId) return false;
  if (target.targetType === EmailAudienceTargetType.GRADE && (!target.grade || target.grade < 1 || target.grade > 12)) return false;
  if (target.targetType === EmailAudienceTargetType.PERSON && !target.personId) return false;
  return true;
}

export async function createAnnouncementInTransaction(tx: TransactionClient, input: CreateAnnouncementInput, actor: string) {
  if (!input.targets.length || input.targets.some((target) => !validateTarget(target))) throw new CommunicationInvariantError("Choose at least one complete audience target.");
  if (input.attachments.length > 5) throw new CommunicationInvariantError("An announcement can include at most five attachments.");
  const totalBytes = input.attachments.reduce((total, attachment) => total + attachment.content.byteLength, 0);
  if (totalBytes > 10 * 1024 * 1024) throw new CommunicationInvariantError("Attachments cannot exceed 10 MB total.");
  if (input.scheduledAt && input.scheduledAt.getTime() <= Date.now() + 60_000) throw new CommunicationInvariantError("Scheduled delivery must be at least one minute in the future.");
  const connection = await tx.emailConnection.findUnique({ where: { programId: input.programId } });
  const announcement = await tx.announcement.create({ data: {
    id: randomUUID(),
    programId: input.programId,
    operatingPeriodId: input.operatingPeriodId,
    emailConnectionId: connection?.id || null,
    subject: clean(input.subject, "Subject", 200),
    body: clean(input.body, "Message", 50_000),
    status: input.scheduledAt ? AnnouncementStatus.SCHEDULED : AnnouncementStatus.READY,
    scheduledAt: input.scheduledAt || null,
    createdBy: actor,
  } });
  await tx.announcementAudienceTarget.createMany({ data: input.targets.map((target) => ({ id: randomUUID(), announcementId: announcement.id, ...target })) });
  for (const attachment of input.attachments) {
    const fileName = clean(attachment.fileName.replaceAll("/", "-").replaceAll("\\", "-"), "Attachment filename", 200);
    if (!attachment.content.byteLength) throw new CommunicationInvariantError(`${fileName} is empty.`);
    await tx.announcementAttachment.create({ data: { id: randomUUID(), announcementId: announcement.id, fileName, mimeType: attachment.mimeType || "application/octet-stream", byteSize: attachment.content.byteLength, sha256: createHash("sha256").update(attachment.content).digest("hex"), content: Uint8Array.from(attachment.content) } });
  }
  await replaceAudienceSnapshot(tx, announcement.id, input.programId, input.targets);
  await tx.announcement.update({ where: { id: announcement.id }, data: { audienceResolvedAt: new Date() } });
  if (input.scheduledAt) await tx.communicationJob.create({ data: { id: randomUUID(), announcementId: announcement.id, runAt: input.scheduledAt, idempotencyKey: `announcement:${announcement.id}:scheduled` } });
  await tx.auditLog.create({ data: { id: randomUUID(), programId: input.programId, actor, action: "CREATE", entityType: "Announcement", entityId: announcement.id, changeSummary: input.scheduledAt ? "Created scheduled email announcement" : "Created email announcement with audience snapshot", changeDiffJson: auditData(["subject", "body", "scheduledAt", "audienceTargets", "attachments"]) } });
  return announcement;
}

export async function createAnnouncement(db: DatabaseClient, input: CreateAnnouncementInput, actor: string) {
  return db.$transaction((tx) => createAnnouncementInTransaction(tx, input, actor));
}

export async function updateAnnouncement(db: DatabaseClient, announcementId: string, input: {
  subject: string;
  body: string;
  scheduledAt?: Date | null;
  targets: AudienceTargetInput[];
  attachments: AnnouncementAttachmentInput[];
  removeAttachmentIds: string[];
}, actor: string) {
  if (!input.targets.length || input.targets.some((target) => !validateTarget(target))) throw new CommunicationInvariantError("Choose at least one complete audience target.");
  if (input.scheduledAt && input.scheduledAt.getTime() <= Date.now() + 60_000) throw new CommunicationInvariantError("Scheduled delivery must be at least one minute in the future.");
  return db.$transaction(async (tx) => {
    const existing = await tx.announcement.findUnique({ where: { id: announcementId }, include: { attachments: true, recipients: { select: { attemptCount: true, status: true } } } });
    if (!existing) throw new CommunicationInvariantError("Announcement not found.");
    if (existing.status !== AnnouncementStatus.READY && existing.status !== AnnouncementStatus.SCHEDULED) throw new CommunicationInvariantError("Only reviewed, unsent announcements can be edited.");
    if (existing.recipients.some((recipient) => recipient.attemptCount > 0 || recipient.status === AnnouncementRecipientStatus.SENT)) throw new CommunicationInvariantError("Delivery history exists, so this announcement is immutable.");
    const removeIds = new Set(input.removeAttachmentIds);
    const remaining = existing.attachments.filter((attachment) => !removeIds.has(attachment.id));
    if (remaining.length + input.attachments.length > 5) throw new CommunicationInvariantError("An announcement can include at most five attachments.");
    const totalBytes = remaining.reduce((total, attachment) => total + attachment.byteSize, 0) + input.attachments.reduce((total, attachment) => total + attachment.content.byteLength, 0);
    if (totalBytes > 10 * 1024 * 1024) throw new CommunicationInvariantError("Attachments cannot exceed 10 MB total.");
    const connection = await tx.emailConnection.findUnique({ where: { programId: existing.programId } });
    await tx.communicationJob.deleteMany({ where: { announcementId } });
    await tx.announcementRecipient.deleteMany({ where: { announcementId } });
    await tx.announcementAudienceTarget.deleteMany({ where: { announcementId } });
    if (removeIds.size) await tx.announcementAttachment.deleteMany({ where: { announcementId, id: { in: [...removeIds] } } });
    await tx.announcementAudienceTarget.createMany({ data: input.targets.map((target) => ({ id: randomUUID(), announcementId, ...target })) });
    for (const attachment of input.attachments) {
      const fileName = clean(attachment.fileName.replaceAll("/", "-").replaceAll("\\", "-"), "Attachment filename", 200);
      if (!attachment.content.byteLength) throw new CommunicationInvariantError(`${fileName} is empty.`);
      await tx.announcementAttachment.create({ data: { id: randomUUID(), announcementId, fileName, mimeType: attachment.mimeType || "application/octet-stream", byteSize: attachment.content.byteLength, sha256: createHash("sha256").update(attachment.content).digest("hex"), content: Uint8Array.from(attachment.content) } });
    }
    await replaceAudienceSnapshot(tx, announcementId, existing.programId, input.targets);
    const updated = await tx.announcement.update({ where: { id: announcementId }, data: {
      emailConnectionId: connection?.id || null,
      subject: clean(input.subject, "Subject", 200),
      body: clean(input.body, "Message", 50_000),
      scheduledAt: input.scheduledAt || null,
      status: input.scheduledAt ? AnnouncementStatus.SCHEDULED : AnnouncementStatus.READY,
      audienceResolvedAt: new Date(),
    } });
    if (input.scheduledAt) await tx.communicationJob.create({ data: { id: randomUUID(), announcementId, runAt: input.scheduledAt, idempotencyKey: `announcement:${announcementId}:scheduled:${randomUUID()}` } });
    await tx.auditLog.create({ data: { id: randomUUID(), programId: existing.programId, actor, action: "UPDATE", entityType: "Announcement", entityId: announcementId, changeSummary: "Updated unsent email announcement and replaced its audience snapshot", changeDiffJson: auditData(["subject", "body", "scheduledAt", "audienceTargets", "attachments"]) } });
    return updated;
  });
}

export async function cancelAnnouncement(db: DatabaseClient, announcementId: string, actor: string) {
  return db.$transaction(async (tx) => {
    const announcement = await tx.announcement.findUniqueOrThrow({ where: { id: announcementId } });
    if (announcement.status === AnnouncementStatus.SENT || announcement.status === AnnouncementStatus.SENDING) throw new CommunicationInvariantError("This announcement can no longer be canceled.");
    const updated = await tx.announcement.update({ where: { id: announcementId }, data: { status: AnnouncementStatus.CANCELED } });
    await tx.communicationJob.updateMany({ where: { announcementId, status: { in: [CommunicationJobStatus.PENDING, CommunicationJobStatus.OVERDUE, CommunicationJobStatus.FAILED] } }, data: { status: CommunicationJobStatus.CANCELED, leaseToken: null, leaseExpiresAt: null } });
    await tx.auditLog.create({ data: { id: randomUUID(), programId: announcement.programId, actor, action: "CANCEL", entityType: "Announcement", entityId: announcementId, changeSummary: "Canceled email announcement" } });
    return updated;
  });
}

export async function sendAnnouncement(db: DatabaseClient, announcementId: string, actor: string) {
  const announcement = await db.announcement.findUnique({ where: { id: announcementId }, include: { emailConnection: true, attachments: true } });
  if (!announcement) throw new CommunicationInvariantError("Announcement not found.");
  if (announcement.status === AnnouncementStatus.SENT || announcement.status === AnnouncementStatus.CANCELED) throw new CommunicationInvariantError("This announcement cannot be sent again.");
  if (!announcement.emailConnection || announcement.emailConnection.status !== EmailConnectionStatus.VERIFIED) throw new CommunicationInvariantError("Verify the shared mailbox connection before sending.");
  await db.announcementRecipient.updateMany({ where: { announcementId, status: AnnouncementRecipientStatus.SENDING, lastAttemptAt: { lt: new Date(Date.now() - 5 * 60_000) } }, data: { status: AnnouncementRecipientStatus.FAILED, lastError: "The prior delivery attempt was interrupted." } });
  const recipients = await db.announcementRecipient.findMany({ where: { announcementId, status: { in: [AnnouncementRecipientStatus.PENDING, AnnouncementRecipientStatus.FAILED] }, permissionResult: AnnouncementRecipientStatus.ELIGIBLE }, orderBy: { displayNameSnapshot: "asc" } });
  if (!recipients.length) throw new CommunicationInvariantError("There are no pending eligible recipients. Review the audience preview.");
  await db.announcement.update({ where: { id: announcementId }, data: { status: AnnouncementStatus.SENDING } });
  for (const recipient of recipients) {
    const attemptedAt = new Date();
    await db.announcementRecipient.update({ where: { id: recipient.id }, data: { status: AnnouncementRecipientStatus.SENDING, lastAttemptAt: attemptedAt, attemptCount: { increment: 1 }, lastError: null } });
    try {
      const result = await deliverEmail({
        connection: announcement.emailConnection,
        to: recipient.emailSnapshot!,
        subject: announcement.subject,
        body: announcement.body,
        attachments: announcement.attachments.map((attachment) => ({ filename: attachment.fileName, contentType: attachment.mimeType, content: attachment.content })),
      });
      await db.$transaction([
        db.announcementRecipient.update({ where: { id: recipient.id }, data: { status: AnnouncementRecipientStatus.SENT, providerMessageId: result.messageId, lastError: null } }),
        db.deliveryAttempt.create({ data: { id: randomUUID(), recipientId: recipient.id, status: DeliveryAttemptStatus.SENT, attemptedAt, completedAt: new Date(), providerMessageId: result.messageId } }),
      ]);
    } catch (error) {
      const detail = transportError(error);
      await db.$transaction([
        db.announcementRecipient.update({ where: { id: recipient.id }, data: { status: AnnouncementRecipientStatus.FAILED, lastError: detail.message } }),
        db.deliveryAttempt.create({ data: { id: randomUUID(), recipientId: recipient.id, status: DeliveryAttemptStatus.FAILED, attemptedAt, completedAt: new Date(), errorCode: detail.code, errorMessage: detail.message } }),
      ]);
    }
  }
  const counts = await db.announcementRecipient.groupBy({ by: ["status"], where: { announcementId }, _count: true });
  const count = (status: AnnouncementRecipientStatus) => counts.find((row) => row.status === status)?._count || 0;
  const sent = count(AnnouncementRecipientStatus.SENT);
  const failed = count(AnnouncementRecipientStatus.FAILED);
  const status = failed ? (sent ? AnnouncementStatus.PARTIAL : AnnouncementStatus.FAILED) : AnnouncementStatus.SENT;
  await db.$transaction([
    db.announcement.update({ where: { id: announcementId }, data: { status, sentAt: sent ? new Date() : null } }),
    db.communicationJob.updateMany({ where: { announcementId, status: CommunicationJobStatus.LEASED }, data: { status: failed ? CommunicationJobStatus.FAILED : CommunicationJobStatus.COMPLETED, leaseToken: null, leaseExpiresAt: null, lastError: failed ? `${failed} recipient deliveries failed.` : null } }),
    db.auditLog.create({ data: { id: randomUUID(), programId: announcement.programId, actor, action: "SEND", entityType: "Announcement", entityId: announcementId, changeSummary: `Email delivery finished: ${sent} accepted, ${failed} failed`, changeDiffJson: auditData(["recipientStatuses", "providerMessageIds"]) } }),
  ]);
  return { sent, failed, status };
}

export async function confirmOverdueAnnouncement(db: DatabaseClient, announcementId: string, actor: string) {
  const job = await db.communicationJob.findFirst({ where: { announcementId, status: CommunicationJobStatus.OVERDUE } });
  if (!job) throw new CommunicationInvariantError("This announcement is not waiting for overdue confirmation.");
  await db.$transaction([
    db.communicationJob.update({ where: { id: job.id }, data: { status: CommunicationJobStatus.PENDING, runAt: new Date(), lastError: null } }),
    db.auditLog.create({ data: { id: randomUUID(), programId: (await db.announcement.findUniqueOrThrow({ where: { id: announcementId } })).programId, actor, action: "CONFIRM", entityType: "Announcement", entityId: announcementId, changeSummary: "Confirmed overdue scheduled email for delivery" } }),
  ]);
}

export async function processDueCommunicationJobs(db: DatabaseClient, startedAt: Date, maxJobs = 3) {
  const now = new Date();
  await db.communicationJob.updateMany({ where: { status: CommunicationJobStatus.LEASED, leaseExpiresAt: { lt: now } }, data: { status: CommunicationJobStatus.PENDING, leaseToken: null, leaseExpiresAt: null, lastError: "The prior worker lease expired before completion." } });
  await db.communicationJob.updateMany({ where: { status: CommunicationJobStatus.PENDING, runAt: { lt: startedAt } }, data: { status: CommunicationJobStatus.OVERDUE, lastError: "Scheduled time passed while BandOS was not running. Staff confirmation is required." } });
  const due = await db.communicationJob.findMany({ where: { status: CommunicationJobStatus.PENDING, runAt: { lte: now } }, orderBy: { runAt: "asc" }, take: maxJobs });
  let processed = 0;
  for (const job of due) {
    const leaseToken = randomUUID();
    const leased = await db.communicationJob.updateMany({ where: { id: job.id, status: CommunicationJobStatus.PENDING }, data: { status: CommunicationJobStatus.LEASED, leaseToken, leaseExpiresAt: new Date(Date.now() + 5 * 60_000), attemptCount: { increment: 1 } } });
    if (!leased.count) continue;
    try {
      await sendAnnouncement(db, job.announcementId, "desktop-worker");
    } catch (error) {
      const detail = transportError(error);
      await db.communicationJob.update({ where: { id: job.id }, data: { status: CommunicationJobStatus.FAILED, leaseToken: null, leaseExpiresAt: null, lastError: detail.message } });
    }
    processed += 1;
  }
  return processed;
}
