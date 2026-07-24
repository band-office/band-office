import type { createPrismaClient } from "@/lib/db";

type DatabaseClient = ReturnType<typeof createPrismaClient>;

export async function announcementHistory(db: DatabaseClient, programId: string) {
  const rows = await db.announcement.findMany({ where: { programId }, include: { recipients: true, _count: { select: { attachments: true } } }, orderBy: { createdAt: "desc" } });
  return rows.map((row) => ({
    announcementId: row.id,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    subject: row.subject,
    status: row.status,
    scheduledAt: row.scheduledAt,
    sentAt: row.sentAt,
    destinations: row.recipients.length,
    eligible: row.recipients.filter((recipient) => recipient.permissionResult === "ELIGIBLE").length,
    accepted: row.recipients.filter((recipient) => recipient.status === "SENT").length,
    failed: row.recipients.filter((recipient) => recipient.status === "FAILED").length,
    attachments: row._count.attachments,
  }));
}

export async function deliveryOutcomes(db: DatabaseClient, programId: string) {
  const rows = await db.announcementRecipient.findMany({ where: { announcement: { programId } }, include: { announcement: true }, orderBy: [{ announcement: { createdAt: "desc" } }, { displayNameSnapshot: "asc" }] });
  return rows.map((row) => ({
    announcementId: row.announcementId,
    subject: row.announcement.subject,
    createdAt: row.announcement.createdAt,
    recipientName: row.displayNameSnapshot,
    email: row.emailSnapshot,
    permissionResult: row.permissionResult,
    deliveryStatus: row.status,
    attempts: row.attemptCount,
    lastAttemptAt: row.lastAttemptAt,
    lastError: row.lastError,
    providerMessageId: row.providerMessageId,
    inclusionReasons: row.inclusionReasonsJson,
  }));
}

export async function contactReadiness(db: DatabaseClient, programId: string) {
  const [people, states] = await Promise.all([
    db.person.findMany({ where: { programId, status: "ACTIVE" }, include: { classifications: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    db.emailContactState.findMany({ where: { programId } }),
  ]);
  const stateByEmail = new Map(states.map((state) => [state.emailNormalized, state]));
  return people.map((person) => {
    const normalized = person.email?.trim().toLowerCase() || null;
    const state = normalized ? stateByEmail.get(normalized) : null;
    return {
      personId: person.id,
      name: `${person.lastName}, ${person.firstName}`,
      classifications: person.classifications.map((item) => item.classification).join("; "),
      email: person.email,
      contactState: normalized ? state?.status || "ENABLED" : "MISSING_EMAIL",
      reason: state?.reason || null,
    };
  });
}
