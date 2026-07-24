-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Program" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "graduationGrade" INTEGER NOT NULL DEFAULT 8,
    "agreementTemplate" TEXT
);
INSERT INTO "new_Program" ("agreementTemplate", "id", "name") SELECT "agreementTemplate", "id", "name" FROM "Program";
DROP TABLE "Program";
ALTER TABLE "new_Program" RENAME TO "Program";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
