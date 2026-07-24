-- CreateTable
CREATE TABLE "LibraryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "composer" TEXT,
    "arranger" TEXT,
    "publisher" TEXT,
    "grade" TEXT,
    "category" TEXT,
    "catalogNumber" TEXT,
    "storageLocation" TEXT,
    "acquisitionDate" DATETIME,
    "acquisitionSource" TEXT,
    "acquisitionCost" DECIMAL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "comments" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LibraryItem_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LibraryComponentNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "componentName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "notedAt" DATETIME NOT NULL,
    "resolvedAt" DATETIME,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "LibraryComponentNote_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "LibraryItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LibraryLoan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "borrowerPersonId" TEXT,
    "borrowerName" TEXT NOT NULL,
    "operatingPeriodId" TEXT NOT NULL,
    "checkedOutAt" DATETIME NOT NULL,
    "expectedReturnAt" DATETIME,
    "returnedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'CHECKED_OUT',
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "LibraryLoan_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "LibraryItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryLoan_borrowerPersonId_fkey" FOREIGN KEY ("borrowerPersonId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryLoan_operatingPeriodId_fkey" FOREIGN KEY ("operatingPeriodId") REFERENCES "OperatingPeriod" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PerformanceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "operatingPeriodId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "performedAt" DATETIME NOT NULL,
    "groupId" TEXT,
    "conductor" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "PerformanceRecord_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "LibraryItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PerformanceRecord_operatingPeriodId_fkey" FOREIGN KEY ("operatingPeriodId") REFERENCES "OperatingPeriod" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PerformanceRecord_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LibraryResource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fileName" TEXT,
    "mimeType" TEXT,
    "byteSize" INTEGER,
    "storageKey" TEXT,
    "contentHash" TEXT,
    "externalUrl" TEXT,
    "copyrightAcknowledgedAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" DATETIME,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "LibraryResource_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "LibraryItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Group" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'CUSTOM',
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Group_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Group" ("active", "createdAt", "description", "id", "kind", "name", "programId", "updatedAt") SELECT "active", "createdAt", "description", "id", "kind", "name", "programId", "updatedAt" FROM "Group";
DROP TABLE "Group";
ALTER TABLE "new_Group" RENAME TO "Group";
CREATE INDEX "Group_programId_kind_active_idx" ON "Group"("programId", "kind", "active");
CREATE UNIQUE INDEX "Group_programId_name_key" ON "Group"("programId", "name");
CREATE TABLE "new_Person" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Person_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Person" ("createdAt", "email", "firstName", "id", "lastName", "notes", "phone", "programId", "status", "updatedAt") SELECT "createdAt", "email", "firstName", "id", "lastName", "notes", "phone", "programId", "status", "updatedAt" FROM "Person";
DROP TABLE "Person";
ALTER TABLE "new_Person" RENAME TO "Person";
CREATE INDEX "Person_programId_status_idx" ON "Person"("programId", "status");
CREATE INDEX "Person_programId_lastName_firstName_idx" ON "Person"("programId", "lastName", "firstName");
CREATE INDEX "Person_programId_email_idx" ON "Person"("programId", "email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "LibraryItem_programId_status_idx" ON "LibraryItem"("programId", "status");

-- CreateIndex
CREATE INDEX "LibraryItem_programId_title_idx" ON "LibraryItem"("programId", "title");

-- CreateIndex
CREATE INDEX "LibraryItem_programId_composer_idx" ON "LibraryItem"("programId", "composer");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryItem_programId_catalogNumber_key" ON "LibraryItem"("programId", "catalogNumber");

-- CreateIndex
CREATE INDEX "LibraryComponentNote_itemId_resolvedAt_idx" ON "LibraryComponentNote"("itemId", "resolvedAt");

-- CreateIndex
CREATE INDEX "LibraryComponentNote_status_resolvedAt_idx" ON "LibraryComponentNote"("status", "resolvedAt");

-- CreateIndex
CREATE INDEX "LibraryLoan_itemId_returnedAt_idx" ON "LibraryLoan"("itemId", "returnedAt");

-- CreateIndex
CREATE INDEX "LibraryLoan_borrowerPersonId_returnedAt_idx" ON "LibraryLoan"("borrowerPersonId", "returnedAt");

-- CreateIndex
CREATE INDEX "LibraryLoan_operatingPeriodId_idx" ON "LibraryLoan"("operatingPeriodId");

-- CreateIndex
CREATE INDEX "LibraryLoan_expectedReturnAt_returnedAt_idx" ON "LibraryLoan"("expectedReturnAt", "returnedAt");

-- CreateIndex
CREATE INDEX "PerformanceRecord_itemId_performedAt_idx" ON "PerformanceRecord"("itemId", "performedAt");

-- CreateIndex
CREATE INDEX "PerformanceRecord_operatingPeriodId_idx" ON "PerformanceRecord"("operatingPeriodId");

-- CreateIndex
CREATE INDEX "PerformanceRecord_groupId_performedAt_idx" ON "PerformanceRecord"("groupId", "performedAt");

-- CreateIndex
CREATE INDEX "LibraryResource_itemId_status_idx" ON "LibraryResource"("itemId", "status");

-- CreateIndex
CREATE INDEX "LibraryResource_storageKey_idx" ON "LibraryResource"("storageKey");
