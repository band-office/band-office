import { createHash, randomUUID } from "node:crypto";
import argon2 from "argon2";
import type { createPrismaClient } from "@/lib/db";

type DatabaseClient = ReturnType<typeof createPrismaClient>;

const FAILURE_LIMIT = 10;
const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;
const RETENTION_MS = 24 * 60 * 60 * 1000;
let dummyPasswordHash: Promise<string> | null = null;

function identifierHash(scope: string, identifier: string) {
  return createHash("sha256")
    .update(`band-office:authentication:${scope}:${identifier.trim().toLowerCase()}`)
    .digest("hex");
}

export async function authenticationAllowed(
  db: DatabaseClient,
  scope: "staff" | "portal",
  identifier: string,
) {
  const throttle = await db.authenticationThrottle.findUnique({
    where: {
      scope_identifierHash: {
        scope,
        identifierHash: identifierHash(scope, identifier),
      },
    },
  });
  return !throttle?.blockedUntil || throttle.blockedUntil <= new Date();
}

export async function recordAuthenticationResult(
  db: DatabaseClient,
  scope: "staff" | "portal",
  identifier: string,
  succeeded: boolean,
) {
  const hash = identifierHash(scope, identifier);
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.authenticationThrottle.deleteMany({
      where: { updatedAt: { lt: new Date(now.getTime() - RETENTION_MS) } },
    });
    const existing = await tx.authenticationThrottle.findUnique({
      where: { scope_identifierHash: { scope, identifierHash: hash } },
    });
    if (succeeded) {
      if (existing) await tx.authenticationThrottle.delete({ where: { id: existing.id } });
      return;
    }
    const inCurrentWindow = existing && existing.windowStartedAt > new Date(now.getTime() - WINDOW_MS);
    const failedAttempts = inCurrentWindow ? existing.failedAttempts + 1 : 1;
    const blockedUntil = failedAttempts >= FAILURE_LIMIT
      ? new Date(now.getTime() + BLOCK_MS)
      : null;
    await tx.authenticationThrottle.upsert({
      where: { scope_identifierHash: { scope, identifierHash: hash } },
      update: {
        failedAttempts,
        windowStartedAt: inCurrentWindow ? existing.windowStartedAt : now,
        blockedUntil,
      },
      create: {
        id: randomUUID(),
        scope,
        identifierHash: hash,
        failedAttempts,
        windowStartedAt: now,
        blockedUntil,
      },
    });
  });
}

export async function verifyPasswordWithoutAccountTimingLeak(
  passwordHash: string | null | undefined,
  password: string,
) {
  dummyPasswordHash ??= argon2.hash("band-office-dummy-password", { type: argon2.argon2id });
  const matches = await argon2.verify(passwordHash || await dummyPasswordHash, password);
  return Boolean(passwordHash) && matches;
}
