-- CreateTable
CREATE TABLE "FormTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "FormTemplate_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FormTemplateVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "retentionDays" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" DATETIME,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "FormTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "FormTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FormQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "versionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "helpText" TEXT,
    "type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "optionsJson" TEXT,
    CONSTRAINT "FormQuestion_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "FormTemplateVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FormCampaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programId" TEXT NOT NULL,
    "operatingPeriodId" TEXT NOT NULL,
    "templateVersionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dueAt" DATETIME,
    "audienceType" TEXT NOT NULL,
    "audienceValue" TEXT,
    "audienceSummary" TEXT NOT NULL,
    "recipientMode" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "groupId" TEXT,
    CONSTRAINT "FormCampaign_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FormCampaign_operatingPeriodId_fkey" FOREIGN KEY ("operatingPeriodId") REFERENCES "OperatingPeriod" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FormCampaign_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "FormTemplateVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FormCampaign_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FormRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "recipientPersonId" TEXT NOT NULL,
    "subjectPersonId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OUTSTANDING',
    "completedAt" DATETIME,
    "waivedAt" DATETIME,
    "retentionExpiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FormRequest_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "FormCampaign" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FormRequest_recipientPersonId_fkey" FOREIGN KEY ("recipientPersonId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FormRequest_subjectPersonId_fkey" FOREIGN KEY ("subjectPersonId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FormResponse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" DATETIME,
    "recordedBy" TEXT NOT NULL,
    "purgedAt" DATETIME,
    CONSTRAINT "FormResponse_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "FormRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FormAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "responseId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "textValue" TEXT,
    "choiceValuesJson" TEXT,
    "booleanValue" BOOLEAN,
    "acknowledgmentRecordedAt" DATETIME,
    CONSTRAINT "FormAnswer_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "FormResponse" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FormAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "FormQuestion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FormUpload" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "responseId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" DATETIME,
    CONSTRAINT "FormUpload_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "FormResponse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FormUpload_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "FormQuestion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FormReminder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "announcementId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "FormReminder_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "FormRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "FormTemplate_programId_archived_updatedAt_idx" ON "FormTemplate"("programId", "archived", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FormTemplate_programId_name_key" ON "FormTemplate"("programId", "name");

-- CreateIndex
CREATE INDEX "FormTemplateVersion_templateId_status_idx" ON "FormTemplateVersion"("templateId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FormTemplateVersion_templateId_version_key" ON "FormTemplateVersion"("templateId", "version");

-- CreateIndex
CREATE INDEX "FormQuestion_versionId_position_idx" ON "FormQuestion"("versionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "FormQuestion_versionId_position_key" ON "FormQuestion"("versionId", "position");

-- CreateIndex
CREATE INDEX "FormCampaign_programId_createdAt_idx" ON "FormCampaign"("programId", "createdAt");

-- CreateIndex
CREATE INDEX "FormCampaign_operatingPeriodId_idx" ON "FormCampaign"("operatingPeriodId");

-- CreateIndex
CREATE INDEX "FormCampaign_templateVersionId_idx" ON "FormCampaign"("templateVersionId");

-- CreateIndex
CREATE INDEX "FormRequest_campaignId_status_idx" ON "FormRequest"("campaignId", "status");

-- CreateIndex
CREATE INDEX "FormRequest_recipientPersonId_status_idx" ON "FormRequest"("recipientPersonId", "status");

-- CreateIndex
CREATE INDEX "FormRequest_subjectPersonId_status_idx" ON "FormRequest"("subjectPersonId", "status");

-- CreateIndex
CREATE INDEX "FormRequest_retentionExpiresAt_idx" ON "FormRequest"("retentionExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "FormRequest_campaignId_recipientPersonId_subjectPersonId_key" ON "FormRequest"("campaignId", "recipientPersonId", "subjectPersonId");

-- CreateIndex
CREATE UNIQUE INDEX "FormResponse_requestId_key" ON "FormResponse"("requestId");

-- CreateIndex
CREATE INDEX "FormResponse_status_submittedAt_idx" ON "FormResponse"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "FormAnswer_questionId_idx" ON "FormAnswer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "FormAnswer_responseId_questionId_key" ON "FormAnswer"("responseId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "FormUpload_storageKey_key" ON "FormUpload"("storageKey");

-- CreateIndex
CREATE INDEX "FormUpload_responseId_status_idx" ON "FormUpload"("responseId", "status");

-- CreateIndex
CREATE INDEX "FormUpload_questionId_status_idx" ON "FormUpload"("questionId", "status");

-- CreateIndex
CREATE INDEX "FormReminder_requestId_createdAt_idx" ON "FormReminder"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "FormReminder_announcementId_idx" ON "FormReminder"("announcementId");
