-- CreateTable
CREATE TABLE "PortalUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "passwordHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PortalUser_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PortalUser_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PortalSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "PortalSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PortalUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PortalPasswordResetRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identifierHash" TEXT NOT NULL,
    "portalUserId" TEXT,
    "codeHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PortalPasswordResetRequest_portalUserId_fkey" FOREIGN KEY ("portalUserId") REFERENCES "PortalUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PortalUser_personId_key" ON "PortalUser"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "PortalUser_programId_emailNormalized_key" ON "PortalUser"("programId", "emailNormalized");

-- CreateIndex
CREATE INDEX "PortalUser_programId_status_idx" ON "PortalUser"("programId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PortalSession_tokenHash_key" ON "PortalSession"("tokenHash");

-- CreateIndex
CREATE INDEX "PortalSession_userId_idx" ON "PortalSession"("userId");

-- CreateIndex
CREATE INDEX "PortalSession_expiresAt_idx" ON "PortalSession"("expiresAt");

-- CreateIndex
CREATE INDEX "PortalPasswordResetRequest_identifierHash_createdAt_idx" ON "PortalPasswordResetRequest"("identifierHash", "createdAt");

-- CreateIndex
CREATE INDEX "PortalPasswordResetRequest_portalUserId_expiresAt_idx" ON "PortalPasswordResetRequest"("portalUserId", "expiresAt");

-- CreateIndex
CREATE INDEX "PortalPasswordResetRequest_expiresAt_idx" ON "PortalPasswordResetRequest"("expiresAt");
