import { createHash, randomInt, randomUUID, randomBytes } from "node:crypto";
import argon2 from "argon2";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  EmailConnectionStatus,
  PersonClassificationType,
  PersonStatus,
  PortalUserStatus,
} from "@/generated/prisma/client";
import type { createPrismaClient } from "@/lib/db";
import { getDb } from "@/lib/db";
import { deliverEmail, type EmailDeliveryInput } from "@/lib/email-transport";
import {
  authenticationAllowed,
  recordAuthenticationResult,
  verifyPasswordWithoutAccountTimingLeak,
} from "@/lib/auth-throttle";

type DatabaseClient = ReturnType<typeof createPrismaClient>;
type EmailDeliverer = (input: EmailDeliveryInput) => Promise<{ messageId: string }>;

const PORTAL_COOKIE_NAME = "bandos_portal_session";
const PORTAL_IDLE_TIMEOUT_MS = 60 * 60 * 1000;
const PORTAL_COOKIE_LIFETIME_MS = 24 * 60 * 60 * 1000;
const RESET_CODE_LIFETIME_MS = 15 * 60 * 1000;
const RESET_REQUEST_LIMIT_PER_HOUR = 3;
const RESET_ATTEMPT_LIMIT = 5;

export class PortalAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PortalAuthError";
  }
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function normalizePortalEmail(email: string) {
  return email.trim().toLowerCase();
}

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function resetIdentifierHash(emailNormalized: string) {
  return hashToken(`bandos:portal-reset:${emailNormalized}`);
}

function resetCode() {
  const testCode = process.env.BANDOS_TEST_RESET_CODE;
  if (process.env.NODE_ENV !== "production" && testCode && /^\d{8}$/.test(testCode)) return testCode;
  return String(randomInt(0, 100_000_000)).padStart(8, "0");
}

export async function createPortalAccount(db: DatabaseClient, personId: string, actor: string) {
  return db.$transaction(async (tx) => {
    const person = await tx.person.findUniqueOrThrow({
      where: { id: personId },
      include: { classifications: true, portalUser: true },
    });
    if (person.portalUser) throw new PortalAuthError("This person already has portal access.");
    if (person.status !== PersonStatus.ACTIVE) throw new PortalAuthError("Only active people can receive portal access.");
    const permitted = person.classifications.some(({ classification }) =>
      classification === PersonClassificationType.STUDENT || classification === PersonClassificationType.GUARDIAN
    );
    if (!permitted) throw new PortalAuthError("Portal access is available only to students and guardians.");
    const emailNormalized = normalizePortalEmail(person.email ?? "");
    if (!validEmail(emailNormalized)) throw new PortalAuthError("Add a valid email address before enabling portal access.");
    const duplicate = await tx.portalUser.findFirst({ where: { programId: person.programId, emailNormalized } });
    if (duplicate) throw new PortalAuthError("That email address is already used by another portal account.");
    const user = await tx.portalUser.create({
      data: {
        id: randomUUID(),
        programId: person.programId,
        personId,
        emailNormalized,
        status: PortalUserStatus.PENDING,
      },
    });
    await tx.auditLog.create({
      data: {
        id: randomUUID(),
        programId: person.programId,
        actor,
        action: "CREATE",
        entityType: "PortalUser",
        entityId: user.id,
        changeSummary: "Enabled student or guardian portal access",
        changeDiffJson: JSON.stringify({ fields: ["personId", "emailNormalized", "status"], values: "[redacted]" }),
      },
    });
    return user;
  });
}

export async function setPortalAccountEnabled(db: DatabaseClient, portalUserId: string, enabled: boolean, actor: string) {
  return db.$transaction(async (tx) => {
    const existing = await tx.portalUser.findUniqueOrThrow({ where: { id: portalUserId } });
    const status = enabled
      ? existing.passwordHash ? PortalUserStatus.ACTIVE : PortalUserStatus.PENDING
      : PortalUserStatus.DISABLED;
    const user = await tx.portalUser.update({ where: { id: portalUserId }, data: { status } });
    if (!enabled) await tx.portalSession.deleteMany({ where: { userId: portalUserId } });
    await tx.auditLog.create({
      data: {
        id: randomUUID(),
        programId: existing.programId,
        actor,
        action: enabled ? "ENABLE" : "DISABLE",
        entityType: "PortalUser",
        entityId: portalUserId,
        changeSummary: `${enabled ? "Enabled" : "Disabled"} student or guardian portal access`,
        changeDiffJson: JSON.stringify({ fields: ["status"], values: "[redacted]" }),
      },
    });
    return user;
  });
}

export async function requestPortalPasswordReset(
  db: DatabaseClient,
  email: string,
  deliverer: EmailDeliverer = deliverEmail,
) {
  const emailNormalized = normalizePortalEmail(email);
  const identifierHash = resetIdentifierHash(emailNormalized);
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  await db.portalPasswordResetRequest.deleteMany({
    where: { expiresAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
  });
  const recentRequests = await db.portalPasswordResetRequest.count({
    where: { identifierHash, createdAt: { gte: oneHourAgo } },
  });
  if (recentRequests >= RESET_REQUEST_LIMIT_PER_HOUR) return { delivery: "rate_limited" as const };

  const code = resetCode();
  const codeHash = await argon2.hash(code, { type: argon2.argon2id });
  const user = validEmail(emailNormalized)
    ? await db.portalUser.findFirst({
        where: {
          emailNormalized,
          status: { in: [PortalUserStatus.PENDING, PortalUserStatus.ACTIVE] },
          person: { status: PersonStatus.ACTIVE },
        },
        include: { program: { include: { emailConnection: true } } },
      })
    : null;
  const request = await db.portalPasswordResetRequest.create({
    data: {
      id: randomUUID(),
      identifierHash,
      portalUserId: user?.id ?? null,
      codeHash,
      expiresAt: new Date(now.getTime() + RESET_CODE_LIFETIME_MS),
    },
  });
  const connection = user?.program.emailConnection;
  if (!user || !connection || connection.status !== EmailConnectionStatus.VERIFIED) {
    return { delivery: "unavailable" as const };
  }
  try {
    await deliverer({
      connection,
      to: user.emailNormalized,
      subject: `${user.program.name} Band Office password reset`,
      body: [
        "Use this one-time code to set a new Band Office portal password:",
        "",
        code,
        "",
        "The code expires in 15 minutes and can be used once.",
        "If you did not request this change, you can ignore this message.",
      ].join("\n"),
      attachments: [],
    });
    return { delivery: "sent" as const, requestId: request.id };
  } catch {
    await db.portalPasswordResetRequest.update({ where: { id: request.id }, data: { usedAt: new Date() } });
    return { delivery: "failed" as const };
  }
}

export async function resetPortalPassword(
  db: DatabaseClient,
  input: { email: string; code: string; password: string },
) {
  const emailNormalized = normalizePortalEmail(input.email);
  if (!validEmail(emailNormalized) || !/^\d{8}$/.test(input.code)) {
    throw new PortalAuthError("The code is invalid or expired.");
  }
  if (input.password.length < 12) throw new PortalAuthError("Password must be at least 12 characters.");
  const user = await db.portalUser.findFirst({
    where: {
      emailNormalized,
      status: { in: [PortalUserStatus.PENDING, PortalUserStatus.ACTIVE] },
      person: { status: PersonStatus.ACTIVE },
    },
  });
  if (!user) throw new PortalAuthError("The code is invalid or expired.");
  const request = await db.portalPasswordResetRequest.findFirst({
    where: {
      portalUserId: user.id,
      identifierHash: resetIdentifierHash(emailNormalized),
      usedAt: null,
      expiresAt: { gt: new Date() },
      failedAttempts: { lt: RESET_ATTEMPT_LIMIT },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!request) throw new PortalAuthError("The code is invalid or expired.");
  if (!(await argon2.verify(request.codeHash, input.code))) {
    await db.portalPasswordResetRequest.update({
      where: { id: request.id },
      data: { failedAttempts: { increment: 1 } },
    });
    throw new PortalAuthError("The code is invalid or expired.");
  }
  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
  await db.$transaction(async (tx) => {
    const claimed = await tx.portalPasswordResetRequest.updateMany({
      where: { id: request.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) throw new PortalAuthError("The code is invalid or expired.");
    await tx.portalPasswordResetRequest.updateMany({
      where: { portalUserId: user.id, id: { not: request.id }, usedAt: null },
      data: { usedAt: new Date() },
    });
    await tx.portalSession.deleteMany({ where: { userId: user.id } });
    await tx.portalUser.update({
      where: { id: user.id },
      data: { passwordHash, status: PortalUserStatus.ACTIVE },
    });
    await tx.auditLog.create({
      data: {
        id: randomUUID(),
        programId: user.programId,
        actor: `portal:${user.personId}`,
        action: "RESET_PASSWORD",
        entityType: "PortalUser",
        entityId: user.id,
        changeSummary: "Student or guardian reset their portal password",
      },
    });
  });
}

export async function authenticatePortal(email: string, password: string) {
  const emailNormalized = normalizePortalEmail(email);
  const db = getDb();
  if (!(await authenticationAllowed(db, "portal", emailNormalized))) return null;
  const user = validEmail(emailNormalized) ? await db.portalUser.findFirst({
    where: {
      emailNormalized,
      status: PortalUserStatus.ACTIVE,
      person: { status: PersonStatus.ACTIVE },
    },
  }) : null;
  const authenticated = await verifyPasswordWithoutAccountTimingLeak(user?.passwordHash, password);
  await recordAuthenticationResult(db, "portal", emailNormalized, authenticated);
  if (!user || !authenticated) return null;
  await createPortalSession(user.id);
  return user;
}

export async function createPortalSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + PORTAL_IDLE_TIMEOUT_MS);
  await getDb().portalSession.create({
    data: { id: randomUUID(), userId, tokenHash: hashToken(token), expiresAt },
  });
  const store = await cookies();
  store.set(PORTAL_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(Date.now() + PORTAL_COOKIE_LIFETIME_MS),
  });
}

export async function getPortalSessionUser() {
  const store = await cookies();
  const token = store.get(PORTAL_COOKIE_NAME)?.value;
  if (!token) return null;
  const db = getDb();
  const session = await db.portalSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        include: {
          person: { include: { classifications: true, studentProfile: true } },
          program: true,
        },
      },
    },
  });
  if (!session || session.expiresAt <= new Date() || session.user.status !== PortalUserStatus.ACTIVE) {
    if (session) await db.portalSession.delete({ where: { id: session.id } });
    return null;
  }
  if (Date.now() - session.lastSeenAt.getTime() > 60_000) {
    await db.portalSession.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date(), expiresAt: new Date(Date.now() + PORTAL_IDLE_TIMEOUT_MS) },
    });
  }
  return session.user;
}

export async function requirePortalUser() {
  const user = await getPortalSessionUser();
  if (!user) redirect("/portal/login");
  return user;
}

export async function destroyPortalSession() {
  const store = await cookies();
  const token = store.get(PORTAL_COOKIE_NAME)?.value;
  if (token) await getDb().portalSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  store.delete(PORTAL_COOKIE_NAME);
}
