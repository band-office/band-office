CREATE TABLE "Program" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

CREATE TABLE "Member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "section" TEXT NOT NULL,
    "schoolStudentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    CONSTRAINT "Member_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "make" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "schoolAssetTag" TEXT,
    "size" TEXT,
    "condition" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "purchaseYear" INTEGER,
    "estimatedValue" DECIMAL,
    "location" TEXT,
    "notes" TEXT,
    CONSTRAINT "Asset_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "AssetComponent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PRESENT',
    "notes" TEXT,
    CONSTRAINT "AssetComponent_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "operatingPeriodId" TEXT NOT NULL,
    "checkedOutAt" DATETIME NOT NULL,
    "expectedReturnAt" DATETIME,
    "conditionOut" TEXT NOT NULL,
    "agreementOnFile" BOOLEAN NOT NULL DEFAULT false,
    "checkedInAt" DATETIME,
    "conditionIn" TEXT,
    "resolution" TEXT,
    "notes" TEXT,
    CONSTRAINT "Assignment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Assignment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Assignment_operatingPeriodId_fkey" FOREIGN KEY ("operatingPeriodId") REFERENCES "OperatingPeriod" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "Repair" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "operatingPeriodId" TEXT NOT NULL,
    "openedAt" DATETIME NOT NULL,
    "description" TEXT NOT NULL,
    "vendor" TEXT,
    "cost" DECIMAL,
    "closedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    CONSTRAINT "Repair_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Repair_operatingPeriodId_fkey" FOREIGN KEY ("operatingPeriodId") REFERENCES "OperatingPeriod" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "OperatingPeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME,
    "periodKind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "archivePath" TEXT,
    CONSTRAINT "OperatingPeriod_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "changeSummary" TEXT NOT NULL,
    "changeDiffJson" TEXT,
    CONSTRAINT "AuditLog_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "Member_programId_status_idx" ON "Member"("programId", "status");
CREATE INDEX "Member_programId_section_idx" ON "Member"("programId", "section");
CREATE UNIQUE INDEX "Member_programId_schoolStudentId_key" ON "Member"("programId", "schoolStudentId");
CREATE INDEX "Asset_programId_category_idx" ON "Asset"("programId", "category");
CREATE INDEX "Asset_programId_status_idx" ON "Asset"("programId", "status");
CREATE UNIQUE INDEX "Asset_programId_schoolAssetTag_key" ON "Asset"("programId", "schoolAssetTag");
CREATE INDEX "AssetComponent_assetId_status_idx" ON "AssetComponent"("assetId", "status");
CREATE INDEX "Assignment_assetId_checkedInAt_idx" ON "Assignment"("assetId", "checkedInAt");
CREATE INDEX "Assignment_memberId_checkedInAt_idx" ON "Assignment"("memberId", "checkedInAt");
CREATE INDEX "Assignment_operatingPeriodId_idx" ON "Assignment"("operatingPeriodId");
CREATE INDEX "Assignment_expectedReturnAt_checkedInAt_idx" ON "Assignment"("expectedReturnAt", "checkedInAt");
CREATE INDEX "Repair_assetId_status_idx" ON "Repair"("assetId", "status");
CREATE INDEX "Repair_operatingPeriodId_idx" ON "Repair"("operatingPeriodId");
CREATE INDEX "OperatingPeriod_programId_status_idx" ON "OperatingPeriod"("programId", "status");
CREATE UNIQUE INDEX "OperatingPeriod_programId_label_key" ON "OperatingPeriod"("programId", "label");
CREATE INDEX "AuditLog_programId_timestamp_idx" ON "AuditLog"("programId", "timestamp");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
