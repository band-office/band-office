PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "Person" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Person_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "StudentProfile" (
    "personId" TEXT NOT NULL PRIMARY KEY,
    "programId" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "schoolStudentId" TEXT,
    CONSTRAINT "StudentProfile_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "PersonClassification" (
    "personId" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    PRIMARY KEY ("personId", "classification"),
    CONSTRAINT "PersonClassification_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Group" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'CUSTOM',
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Group_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "GroupMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "roleLabel" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    CONSTRAINT "GroupMembership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GroupMembership_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "GuardianStudent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guardianId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "relationshipLabel" TEXT,
    "primaryContact" BOOLEAN NOT NULL DEFAULT false,
    "receivesCommunication" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "GuardianStudent_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GuardianStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "Person" ("id", "programId", "firstName", "lastName", "status", "notes")
SELECT "id", "programId", "firstName", "lastName", "status", "notes" FROM "Member";

INSERT INTO "StudentProfile" ("personId", "programId", "grade", "schoolStudentId")
SELECT "id", "programId", "grade", "schoolStudentId" FROM "Member";

INSERT INTO "PersonClassification" ("personId", "classification")
SELECT "id", 'STUDENT' FROM "Member";

INSERT INTO "Group" ("id", "programId", "name", "kind")
SELECT "programId" || ':section:' || lower(trim("section")), "programId", trim("section"), 'SECTION'
FROM "Member"
WHERE trim("section") <> ''
GROUP BY "programId", lower(trim("section"));

INSERT INTO "GroupMembership" ("id", "groupId", "personId")
SELECT "id" || ':membership:' || "programId" || ':section:' || lower(trim("section")),
       "programId" || ':section:' || lower(trim("section")), "id"
FROM "Member"
WHERE trim("section") <> '';

INSERT INTO "Person" ("id", "programId", "firstName", "lastName", "status")
SELECT 'staff-person:' || "id", "programId", "username", '', 'ACTIVE' FROM "StaffUser";

INSERT INTO "PersonClassification" ("personId", "classification")
SELECT 'staff-person:' || "id", 'STAFF' FROM "StaffUser";

CREATE TABLE "new_StaffUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'READ_ONLY',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StaffUser_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StaffUser_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_StaffUser" ("id", "programId", "personId", "username", "passwordHash", "role", "createdAt", "updatedAt")
SELECT "id", "programId", 'staff-person:' || "id", "username", "passwordHash", 'DIRECTOR', "createdAt", "updatedAt" FROM "StaffUser";
DROP TABLE "StaffUser";
ALTER TABLE "new_StaffUser" RENAME TO "StaffUser";

CREATE TABLE "new_Assignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "groupId" TEXT,
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
    CONSTRAINT "Assignment_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Assignment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Assignment_operatingPeriodId_fkey" FOREIGN KEY ("operatingPeriodId") REFERENCES "OperatingPeriod" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Assignment" ("id", "assetId", "personId", "groupId", "operatingPeriodId", "checkedOutAt", "expectedReturnAt", "conditionOut", "agreementOnFile", "checkedInAt", "conditionIn", "resolution", "notes")
SELECT assignment."id", assignment."assetId", assignment."memberId",
       member."programId" || ':section:' || lower(trim(member."section")),
       assignment."operatingPeriodId", assignment."checkedOutAt", assignment."expectedReturnAt", assignment."conditionOut", assignment."agreementOnFile", assignment."checkedInAt", assignment."conditionIn", assignment."resolution", assignment."notes"
FROM "Assignment" AS assignment
INNER JOIN "Member" AS member ON member."id" = assignment."memberId";
DROP TABLE "Assignment";
ALTER TABLE "new_Assignment" RENAME TO "Assignment";

UPDATE "AuditLog" SET "entityType" = 'Person' WHERE "entityType" = 'Member';
DROP TABLE "Member";

CREATE INDEX "Person_programId_status_idx" ON "Person"("programId", "status");
CREATE INDEX "Person_programId_lastName_firstName_idx" ON "Person"("programId", "lastName", "firstName");
CREATE INDEX "Person_programId_email_idx" ON "Person"("programId", "email");
CREATE UNIQUE INDEX "StudentProfile_programId_schoolStudentId_key" ON "StudentProfile"("programId", "schoolStudentId");
CREATE INDEX "StudentProfile_programId_grade_idx" ON "StudentProfile"("programId", "grade");
CREATE INDEX "PersonClassification_classification_idx" ON "PersonClassification"("classification");
CREATE UNIQUE INDEX "Group_programId_name_key" ON "Group"("programId", "name");
CREATE INDEX "Group_programId_kind_active_idx" ON "Group"("programId", "kind", "active");
CREATE UNIQUE INDEX "GroupMembership_groupId_personId_key" ON "GroupMembership"("groupId", "personId");
CREATE INDEX "GroupMembership_personId_endedAt_idx" ON "GroupMembership"("personId", "endedAt");
CREATE INDEX "GroupMembership_groupId_endedAt_idx" ON "GroupMembership"("groupId", "endedAt");
CREATE UNIQUE INDEX "GuardianStudent_guardianId_studentId_key" ON "GuardianStudent"("guardianId", "studentId");
CREATE INDEX "GuardianStudent_studentId_idx" ON "GuardianStudent"("studentId");
CREATE UNIQUE INDEX "StaffUser_personId_key" ON "StaffUser"("personId");
CREATE INDEX "StaffUser_programId_idx" ON "StaffUser"("programId");
CREATE UNIQUE INDEX "StaffUser_programId_username_key" ON "StaffUser"("programId", "username");
CREATE INDEX "Assignment_assetId_checkedInAt_idx" ON "Assignment"("assetId", "checkedInAt");
CREATE INDEX "Assignment_personId_checkedInAt_idx" ON "Assignment"("personId", "checkedInAt");
CREATE INDEX "Assignment_groupId_checkedInAt_idx" ON "Assignment"("groupId", "checkedInAt");
CREATE INDEX "Assignment_operatingPeriodId_idx" ON "Assignment"("operatingPeriodId");
CREATE INDEX "Assignment_expectedReturnAt_checkedInAt_idx" ON "Assignment"("expectedReturnAt", "checkedInAt");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
