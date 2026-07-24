import { createHash, randomBytes, randomUUID } from "node:crypto";
import argon2 from "argon2";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PersonClassificationType, PersonStatus, StaffRole } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";

const COOKIE_NAME = "bandos_session";
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const COOKIE_LIFETIME_MS = 12 * 60 * 60 * 1000;

export type Permission = "VIEW_PEOPLE" | "VIEW_CONTACT_DETAILS" | "VIEW_FAMILY_LINKS" | "MANAGE_PEOPLE" | "VIEW_GROUPS" | "MANAGE_GROUPS" | "VIEW_INVENTORY" | "MANAGE_INVENTORY" | "MANAGE_ASSIGNMENTS" | "VIEW_REPAIRS" | "MANAGE_REPAIRS" | "VIEW_REPORTS" | "VIEW_FINANCIALS" | "MANAGE_FINANCIALS" | "VIEW_COMMUNICATIONS" | "MANAGE_COMMUNICATIONS" | "VIEW_LIBRARY" | "MANAGE_LIBRARY" | "VIEW_FORMS" | "MANAGE_FORMS" | "RECORD_FORM_RESPONSES" | "VIEW_EVENTS" | "MANAGE_EVENTS" | "RECORD_ATTENDANCE" | "EXPORT_DATA" | "ROLLOVER" | "MANAGE_SETTINGS" | "MANAGE_USERS" | "VIEW_NOTES";

export const ALL_PERMISSIONS: Permission[] = ["VIEW_PEOPLE", "VIEW_CONTACT_DETAILS", "VIEW_FAMILY_LINKS", "MANAGE_PEOPLE", "VIEW_GROUPS", "MANAGE_GROUPS", "VIEW_INVENTORY", "MANAGE_INVENTORY", "MANAGE_ASSIGNMENTS", "VIEW_REPAIRS", "MANAGE_REPAIRS", "VIEW_REPORTS", "VIEW_FINANCIALS", "MANAGE_FINANCIALS", "VIEW_COMMUNICATIONS", "MANAGE_COMMUNICATIONS", "VIEW_LIBRARY", "MANAGE_LIBRARY", "VIEW_FORMS", "MANAGE_FORMS", "RECORD_FORM_RESPONSES", "VIEW_EVENTS", "MANAGE_EVENTS", "RECORD_ATTENDANCE", "EXPORT_DATA", "ROLLOVER", "MANAGE_SETTINGS", "MANAGE_USERS", "VIEW_NOTES"];

const ROLE_PERMISSIONS: Record<StaffRole, ReadonlySet<Permission>> = {
  [StaffRole.DIRECTOR]: new Set(ALL_PERMISSIONS),
  [StaffRole.ASSISTANT_DIRECTOR]: new Set(ALL_PERMISSIONS.filter((permission) => !["ROLLOVER", "MANAGE_SETTINGS", "MANAGE_USERS"].includes(permission))),
  [StaffRole.INVENTORY_HELPER]: new Set(["VIEW_PEOPLE", "VIEW_GROUPS", "VIEW_INVENTORY", "MANAGE_INVENTORY", "MANAGE_ASSIGNMENTS", "VIEW_REPAIRS", "VIEW_REPORTS"]),
  [StaffRole.READ_ONLY]: new Set(["VIEW_PEOPLE", "VIEW_CONTACT_DETAILS", "VIEW_FAMILY_LINKS", "VIEW_GROUPS", "VIEW_INVENTORY", "VIEW_REPAIRS", "VIEW_REPORTS"]),
};

export function hasPermission(user: { role: StaffRole }, permission: Permission) {
  return ROLE_PERMISSIONS[user.role].has(permission);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function hasStaffUser() {
  return (await getDb().staffUser.count()) > 0;
}

function initialPeriod(now = new Date()) {
  const firstYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    label: `${firstYear}-${String(firstYear + 1).slice(-2)}`,
    startsAt: new Date(Date.UTC(firstYear, 6, 1)),
  };
}

export async function setupFirstInstallation(programName: string, username: string, password: string) {
  const db = getDb();
  if (await db.staffUser.count()) throw new Error("The director account already exists.");
  if (!programName.trim()) throw new Error("Program name is required.");
  if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) throw new Error("Username must be 3-40 letters, numbers, dots, dashes, or underscores.");
  if (password.length < 12) throw new Error("Password must be at least 12 characters.");
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  return db.$transaction(async (tx) => {
    if (await tx.staffUser.count()) throw new Error("The director account already exists.");
    let program = await tx.program.findFirst({ orderBy: { name: "asc" } });
    if (!program) {
      const period = initialPeriod();
      program = await tx.program.create({ data: { id: randomUUID(), name: programName.trim() } });
      await tx.operatingPeriod.create({ data: { id: randomUUID(), programId: program.id, label: period.label, startsAt: period.startsAt, periodKind: "school_year" } });
      await tx.auditLog.create({ data: { id: randomUUID(), programId: program.id, actor: username, action: "CREATE", entityType: "Program", entityId: program.id, changeSummary: "Created local BandOS program" } });
    }
    const person = await tx.person.create({ data: { id: randomUUID(), programId: program.id, firstName: username, lastName: "", status: PersonStatus.ACTIVE } });
    await tx.personClassification.create({ data: { personId: person.id, classification: PersonClassificationType.STAFF } });
    const user = await tx.staffUser.create({ data: { id: randomUUID(), programId: program.id, personId: person.id, username, passwordHash, role: StaffRole.DIRECTOR } });
    await tx.auditLog.create({ data: { id: randomUUID(), programId: program.id, actor: username, action: "CREATE", entityType: "StaffUser", entityId: user.id, changeSummary: "Created initial director account" } });
    return user;
  });
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + IDLE_TIMEOUT_MS);
  await getDb().session.create({ data: { id: randomUUID(), userId, tokenHash: hashToken(token), expiresAt } });
  const store = await cookies();
  store.set(COOKIE_NAME, token, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", expires: new Date(Date.now() + COOKIE_LIFETIME_MS) });
}

export async function authenticate(username: string, password: string) {
  const user = await getDb().staffUser.findFirst({ where: { username } });
  if (!user || !(await argon2.verify(user.passwordHash, password))) return null;
  await createSession(user.id);
  return user;
}

export async function getSessionUser() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const db = getDb();
  const session = await db.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!session || session.expiresAt <= new Date()) {
    if (session) await db.session.delete({ where: { id: session.id } });
    return null;
  }
  const expiresAt = new Date(Date.now() + IDLE_TIMEOUT_MS);
  if (Date.now() - session.lastSeenAt.getTime() > 60_000) {
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date(), expiresAt } });
  }
  return session.user;
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireApiUser() {
  return getSessionUser();
}

export async function requirePermission(permission: Permission) {
  const user = await getSessionUser();
  if (!user) throw new Error("Your session expired. Sign in and try again.");
  if (!hasPermission(user, permission)) throw new Error("Your account does not have permission for that operation.");
  return user;
}

export async function createStaffAccount(input: { programId: string; personId: string; username: string; password: string; role: StaffRole }, actor: string) {
  if (!/^[a-zA-Z0-9._-]{3,40}$/.test(input.username)) throw new Error("Username must be 3-40 letters, numbers, dots, dashes, or underscores.");
  if (input.password.length < 12) throw new Error("Password must be at least 12 characters.");
  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
  return getDb().$transaction(async (tx) => {
    const person = await tx.person.findUniqueOrThrow({ where: { id: input.personId } });
    if (person.programId !== input.programId) throw new Error("Staff account and person must belong to one program.");
    await tx.personClassification.upsert({ where: { personId_classification: { personId: person.id, classification: PersonClassificationType.STAFF } }, update: {}, create: { personId: person.id, classification: PersonClassificationType.STAFF } });
    const user = await tx.staffUser.create({ data: { id: randomUUID(), programId: input.programId, personId: input.personId, username: input.username, role: input.role, passwordHash } });
    await tx.auditLog.create({ data: { id: randomUUID(), programId: input.programId, actor, action: "CREATE", entityType: "StaffUser", entityId: user.id, changeSummary: "Created local staff account", changeDiffJson: JSON.stringify({ fields: ["personId", "username", "role"], values: "[redacted]" }) } });
    return user;
  });
}

export async function updateStaffRole(userId: string, role: StaffRole, actor: string) {
  return getDb().$transaction(async (tx) => {
    const existing = await tx.staffUser.findUniqueOrThrow({ where: { id: userId } });
    if (existing.role === StaffRole.DIRECTOR && role !== StaffRole.DIRECTOR) {
      const directorCount = await tx.staffUser.count({ where: { programId: existing.programId, role: StaffRole.DIRECTOR } });
      if (directorCount <= 1) throw new Error("The final director account cannot be demoted.");
    }
    const user = await tx.staffUser.update({ where: { id: userId }, data: { role } });
    await tx.auditLog.create({ data: { id: randomUUID(), programId: existing.programId, actor, action: "UPDATE", entityType: "StaffUser", entityId: user.id, changeSummary: "Updated staff account role", changeDiffJson: JSON.stringify({ fields: ["role"], values: "[redacted]" }) } });
    return user;
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) await getDb().session.deleteMany({ where: { tokenHash: hashToken(token) } });
  store.delete(COOKIE_NAME);
}
