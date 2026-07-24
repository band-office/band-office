-- CreateTable
CREATE TABLE "EventSeries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "EventSeries_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programId" TEXT NOT NULL,
    "operatingPeriodId" TEXT NOT NULL,
    "seriesId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME,
    "location" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "itinerary" TEXT,
    "notes" TEXT,
    "rsvpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "attendanceEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "Event_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Event_operatingPeriodId_fkey" FOREIGN KEY ("operatingPeriodId") REFERENCES "OperatingPeriod" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Event_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "EventSeries" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "includedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" DATETIME,
    CONSTRAINT "EventGroup_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EventGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" DATETIME,
    "addedBy" TEXT NOT NULL,
    CONSTRAINT "EventParticipant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EventParticipant_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventRsvp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "participantId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "recordedAt" DATETIME,
    "recordedBy" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EventRsvp_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "EventParticipant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "participantId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_RECORDED',
    "recordedAt" DATETIME,
    "recordedBy" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AttendanceRecord_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "EventParticipant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventEquipmentItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "assetId" TEXT,
    "label" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "packedQuantity" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "EventEquipmentItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EventEquipmentItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventResource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fileName" TEXT,
    "mimeType" TEXT,
    "byteSize" INTEGER,
    "storageKey" TEXT,
    "contentHash" TEXT,
    "externalUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" DATETIME,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "EventResource_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VolunteerOpportunity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" DATETIME,
    "endsAt" DATETIME,
    "capacity" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "VolunteerOpportunity_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VolunteerSignup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "opportunityId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "signedUpAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "VolunteerSignup_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "VolunteerOpportunity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VolunteerSignup_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventReminder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "announcementId" TEXT,
    "audience" TEXT NOT NULL,
    "scheduledFor" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "EventReminder_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EventReminder_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CalendarSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    "lastUsedAt" DATETIME,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "CalendarSubscription_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "EventSeries_programId_active_idx" ON "EventSeries"("programId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "EventSeries_programId_name_key" ON "EventSeries"("programId", "name");

-- CreateIndex
CREATE INDEX "Event_programId_startsAt_idx" ON "Event"("programId", "startsAt");

-- CreateIndex
CREATE INDEX "Event_programId_status_startsAt_idx" ON "Event"("programId", "status", "startsAt");

-- CreateIndex
CREATE INDEX "Event_operatingPeriodId_idx" ON "Event"("operatingPeriodId");

-- CreateIndex
CREATE INDEX "Event_seriesId_startsAt_idx" ON "Event"("seriesId", "startsAt");

-- CreateIndex
CREATE INDEX "EventGroup_groupId_removedAt_idx" ON "EventGroup"("groupId", "removedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventGroup_eventId_groupId_key" ON "EventGroup"("eventId", "groupId");

-- CreateIndex
CREATE INDEX "EventParticipant_eventId_status_idx" ON "EventParticipant"("eventId", "status");

-- CreateIndex
CREATE INDEX "EventParticipant_personId_status_idx" ON "EventParticipant"("personId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EventParticipant_eventId_personId_key" ON "EventParticipant"("eventId", "personId");

-- CreateIndex
CREATE UNIQUE INDEX "EventRsvp_participantId_key" ON "EventRsvp"("participantId");

-- CreateIndex
CREATE INDEX "EventRsvp_status_recordedAt_idx" ON "EventRsvp"("status", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_participantId_key" ON "AttendanceRecord"("participantId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_status_recordedAt_idx" ON "AttendanceRecord"("status", "recordedAt");

-- CreateIndex
CREATE INDEX "EventEquipmentItem_eventId_idx" ON "EventEquipmentItem"("eventId");

-- CreateIndex
CREATE INDEX "EventEquipmentItem_assetId_idx" ON "EventEquipmentItem"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "EventResource_storageKey_key" ON "EventResource"("storageKey");

-- CreateIndex
CREATE INDEX "EventResource_eventId_status_idx" ON "EventResource"("eventId", "status");

-- CreateIndex
CREATE INDEX "EventResource_storageKey_idx" ON "EventResource"("storageKey");

-- CreateIndex
CREATE INDEX "VolunteerOpportunity_eventId_status_idx" ON "VolunteerOpportunity"("eventId", "status");

-- CreateIndex
CREATE INDEX "VolunteerSignup_personId_status_idx" ON "VolunteerSignup"("personId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "VolunteerSignup_opportunityId_personId_key" ON "VolunteerSignup"("opportunityId", "personId");

-- CreateIndex
CREATE INDEX "EventReminder_eventId_createdAt_idx" ON "EventReminder"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "EventReminder_announcementId_idx" ON "EventReminder"("announcementId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarSubscription_tokenHash_key" ON "CalendarSubscription"("tokenHash");

-- CreateIndex
CREATE INDEX "CalendarSubscription_programId_revokedAt_idx" ON "CalendarSubscription"("programId", "revokedAt");
