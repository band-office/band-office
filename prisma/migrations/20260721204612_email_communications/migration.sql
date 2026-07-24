-- CreateTable
CREATE TABLE "EmailConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'SMTP',
    "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "fromName" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "replyTo" TEXT,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpSecure" BOOLEAN NOT NULL DEFAULT false,
    "authUsername" TEXT,
    "credentialReference" TEXT,
    "lastVerifiedAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmailConnection_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmailContactState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programId" TEXT NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ENABLED',
    "reason" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "updatedBy" TEXT NOT NULL,
    CONSTRAINT "EmailContactState_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "EmailTemplate_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programId" TEXT NOT NULL,
    "operatingPeriodId" TEXT NOT NULL,
    "emailConnectionId" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" DATETIME,
    "audienceResolvedAt" DATETIME,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "Announcement_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Announcement_operatingPeriodId_fkey" FOREIGN KEY ("operatingPeriodId") REFERENCES "OperatingPeriod" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Announcement_emailConnectionId_fkey" FOREIGN KEY ("emailConnectionId") REFERENCES "EmailConnection" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnnouncementAudienceTarget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "announcementId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "recipientKind" TEXT NOT NULL DEFAULT 'SELF',
    "classification" TEXT,
    "groupId" TEXT,
    "grade" INTEGER,
    "personId" TEXT,
    CONSTRAINT "AnnouncementAudienceTarget_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AnnouncementAudienceTarget_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AnnouncementAudienceTarget_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnnouncementRecipient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "announcementId" TEXT NOT NULL,
    "destinationKey" TEXT NOT NULL,
    "emailSnapshot" TEXT,
    "emailNormalized" TEXT,
    "displayNameSnapshot" TEXT NOT NULL,
    "associatedPersonIdsJson" TEXT NOT NULL,
    "inclusionReasonsJson" TEXT NOT NULL,
    "permissionResult" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" DATETIME,
    "lastError" TEXT,
    "providerMessageId" TEXT,
    CONSTRAINT "AnnouncementRecipient_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnnouncementAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "announcementId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "content" BLOB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnnouncementAttachment_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeliveryAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipientId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attemptedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "providerMessageId" TEXT,
    CONSTRAINT "DeliveryAttempt_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "AnnouncementRecipient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommunicationJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "announcementId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "runAt" DATETIME NOT NULL,
    "leaseToken" TEXT,
    "leaseExpiresAt" DATETIME,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "idempotencyKey" TEXT NOT NULL,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CommunicationJob_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailConnection_programId_key" ON "EmailConnection"("programId");

-- CreateIndex
CREATE INDEX "EmailConnection_programId_status_idx" ON "EmailConnection"("programId", "status");

-- CreateIndex
CREATE INDEX "EmailContactState_programId_status_idx" ON "EmailContactState"("programId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EmailContactState_programId_emailNormalized_key" ON "EmailContactState"("programId", "emailNormalized");

-- CreateIndex
CREATE INDEX "EmailTemplate_programId_updatedAt_idx" ON "EmailTemplate"("programId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_programId_name_key" ON "EmailTemplate"("programId", "name");

-- CreateIndex
CREATE INDEX "Announcement_programId_createdAt_idx" ON "Announcement"("programId", "createdAt");

-- CreateIndex
CREATE INDEX "Announcement_programId_status_scheduledAt_idx" ON "Announcement"("programId", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "Announcement_operatingPeriodId_idx" ON "Announcement"("operatingPeriodId");

-- CreateIndex
CREATE INDEX "AnnouncementAudienceTarget_announcementId_idx" ON "AnnouncementAudienceTarget"("announcementId");

-- CreateIndex
CREATE INDEX "AnnouncementAudienceTarget_groupId_idx" ON "AnnouncementAudienceTarget"("groupId");

-- CreateIndex
CREATE INDEX "AnnouncementAudienceTarget_personId_idx" ON "AnnouncementAudienceTarget"("personId");

-- CreateIndex
CREATE INDEX "AnnouncementRecipient_announcementId_status_idx" ON "AnnouncementRecipient"("announcementId", "status");

-- CreateIndex
CREATE INDEX "AnnouncementRecipient_emailNormalized_idx" ON "AnnouncementRecipient"("emailNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementRecipient_announcementId_destinationKey_key" ON "AnnouncementRecipient"("announcementId", "destinationKey");

-- CreateIndex
CREATE INDEX "AnnouncementAttachment_announcementId_idx" ON "AnnouncementAttachment"("announcementId");

-- CreateIndex
CREATE INDEX "DeliveryAttempt_recipientId_attemptedAt_idx" ON "DeliveryAttempt"("recipientId", "attemptedAt");

-- CreateIndex
CREATE INDEX "DeliveryAttempt_status_attemptedAt_idx" ON "DeliveryAttempt"("status", "attemptedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationJob_idempotencyKey_key" ON "CommunicationJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CommunicationJob_status_runAt_idx" ON "CommunicationJob"("status", "runAt");

-- CreateIndex
CREATE INDEX "CommunicationJob_announcementId_idx" ON "CommunicationJob"("announcementId");
