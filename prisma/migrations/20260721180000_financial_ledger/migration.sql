CREATE TABLE "FinancialBatch" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "programId" TEXT NOT NULL,
  "operatingPeriodId" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "amount" DECIMAL NOT NULL CHECK ("amount" > 0),
  "occurredAt" DATETIME NOT NULL,
  "dueDate" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT NOT NULL,
  CONSTRAINT "FinancialBatch_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FinancialBatch_operatingPeriodId_fkey" FOREIGN KEY ("operatingPeriodId") REFERENCES "OperatingPeriod" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FinancialBatch_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "FinancialEntry" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "programId" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  "operatingPeriodId" TEXT NOT NULL,
  "groupId" TEXT,
  "batchId" TEXT,
  "type" TEXT NOT NULL CHECK ("type" IN ('CHARGE', 'PAYMENT', 'CREDIT', 'REVERSAL')),
  "amount" DECIMAL NOT NULL CHECK ("amount" <> 0),
  "occurredAt" DATETIME NOT NULL,
  "dueDate" DATETIME,
  "description" TEXT NOT NULL,
  "reference" TEXT,
  "reversalOfId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT NOT NULL,
  CONSTRAINT "FinancialEntry_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FinancialEntry_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FinancialEntry_operatingPeriodId_fkey" FOREIGN KEY ("operatingPeriodId") REFERENCES "OperatingPeriod" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FinancialEntry_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FinancialEntry_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "FinancialBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FinancialEntry_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "FinancialEntry" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "FinancialBatch_programId_occurredAt_idx" ON "FinancialBatch"("programId", "occurredAt");
CREATE INDEX "FinancialBatch_groupId_occurredAt_idx" ON "FinancialBatch"("groupId", "occurredAt");
CREATE INDEX "FinancialBatch_operatingPeriodId_idx" ON "FinancialBatch"("operatingPeriodId");
CREATE UNIQUE INDEX "FinancialEntry_reversalOfId_key" ON "FinancialEntry"("reversalOfId");
CREATE INDEX "FinancialEntry_programId_occurredAt_idx" ON "FinancialEntry"("programId", "occurredAt");
CREATE INDEX "FinancialEntry_personId_occurredAt_idx" ON "FinancialEntry"("personId", "occurredAt");
CREATE INDEX "FinancialEntry_operatingPeriodId_idx" ON "FinancialEntry"("operatingPeriodId");
CREATE INDEX "FinancialEntry_groupId_idx" ON "FinancialEntry"("groupId");
CREATE INDEX "FinancialEntry_batchId_idx" ON "FinancialEntry"("batchId");
CREATE INDEX "FinancialEntry_type_idx" ON "FinancialEntry"("type");
