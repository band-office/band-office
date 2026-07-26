CREATE TABLE "AuthenticationThrottle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scope" TEXT NOT NULL,
    "identifierHash" TEXT NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blockedUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "AuthenticationThrottle_scope_identifierHash_key"
ON "AuthenticationThrottle"("scope", "identifierHash");

CREATE INDEX "AuthenticationThrottle_updatedAt_idx"
ON "AuthenticationThrottle"("updatedAt");

CREATE INDEX "AuthenticationThrottle_blockedUntil_idx"
ON "AuthenticationThrottle"("blockedUntil");
