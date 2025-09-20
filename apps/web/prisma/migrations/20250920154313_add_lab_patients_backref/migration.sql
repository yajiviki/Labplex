/*
  Warnings:

  - You are about to drop the column `code` on the `Lab` table. All the data in the column will be lost.
  - Added the required column `labCode` to the `Lab` table without a default value. This is not possible if the table is not empty.
  - Added the required column `phone` to the `Lab` table without a default value. This is not possible if the table is not empty.
  - Made the column `name` on table `Lab` required. This step will fail if there are existing NULL values in that column.
  - Made the column `name` on table `User` required. This step will fail if there are existing NULL values in that column.
  - Made the column `phone` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Lab" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Lab" ("createdAt", "id", "name", "updatedAt") SELECT "createdAt", "id", "name", "updatedAt" FROM "Lab";
DROP TABLE "Lab";
ALTER TABLE "new_Lab" RENAME TO "Lab";
CREATE UNIQUE INDEX "Lab_labCode_key" ON "Lab"("labCode");
CREATE UNIQUE INDEX "Lab_email_key" ON "Lab"("email");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labId" TEXT,
    "employeeId" TEXT,
    "userType" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "email" TEXT,
    "password" TEXT NOT NULL,
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "dob" DATETIME,
    "address" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("address", "createdAt", "dob", "email", "employeeId", "id", "isActive", "labId", "name", "password", "phone", "role", "updatedAt", "userType") SELECT "address", "createdAt", "dob", "email", "employeeId", "id", "isActive", "labId", "name", "password", "phone", "role", "updatedAt", "userType" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
