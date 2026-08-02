CREATE TABLE "MigrationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "actor" TEXT NOT NULL,
    "cutoverAt" DATETIME NOT NULL,
    "summaryJson" TEXT NOT NULL,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MigrationRun_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "MigrationSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "migrationRunId" TEXT NOT NULL,
    "sourceKind" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "headersJson" TEXT NOT NULL,
    "mappingJson" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    CONSTRAINT "MigrationSource_migrationRunId_fkey" FOREIGN KEY ("migrationRunId") REFERENCES "MigrationRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "MigrationIssue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "migrationRunId" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'WARNING',
    "code" TEXT NOT NULL,
    "sourceKind" TEXT,
    "rowNumber" INTEGER,
    "message" TEXT NOT NULL,
    CONSTRAINT "MigrationIssue_migrationRunId_fkey" FOREIGN KEY ("migrationRunId") REFERENCES "MigrationRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ExternalReference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programId" TEXT NOT NULL,
    "migrationRunId" TEXT,
    "source" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExternalReference_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExternalReference_migrationRunId_fkey" FOREIGN KEY ("migrationRunId") REFERENCES "MigrationRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "MigrationRun_programId_completedAt_idx" ON "MigrationRun"("programId", "completedAt");
CREATE UNIQUE INDEX "MigrationSource_migrationRunId_sourceKind_contentHash_key" ON "MigrationSource"("migrationRunId", "sourceKind", "contentHash");
CREATE INDEX "MigrationSource_migrationRunId_idx" ON "MigrationSource"("migrationRunId");
CREATE INDEX "MigrationIssue_migrationRunId_severity_idx" ON "MigrationIssue"("migrationRunId", "severity");
CREATE UNIQUE INDEX "ExternalReference_programId_source_entityType_sourceId_key" ON "ExternalReference"("programId", "source", "entityType", "sourceId");
CREATE INDEX "ExternalReference_programId_entityType_entityId_idx" ON "ExternalReference"("programId", "entityType", "entityId");
CREATE INDEX "ExternalReference_migrationRunId_idx" ON "ExternalReference"("migrationRunId");
