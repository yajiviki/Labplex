/*
  Warnings:

  - You are about to drop the column `usedAt` on the `PasswordSetupToken` table. All the data in the column will be lost.
  - You are about to drop the column `insuranceCompanyId` on the `Patient` table. All the data in the column will be lost.
  - You are about to drop the column `vendorId` on the `Patient` table. All the data in the column will be lost.
  - Made the column `labCode` on table `Lab` required. This step will fail if there are existing NULL values in that column.
  - Made the column `labId` on table `Patient` required. This step will fail if there are existing NULL values in that column.
  - Made the column `labId` on table `User` required. This step will fail if there are existing NULL values in that column.
  - Made the column `userId` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Appointment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labId" TEXT NOT NULL,
    "patientIdRef" TEXT,
    "source" TEXT NOT NULL,
    "proposalNo" TEXT,
    "patientId" TEXT,
    "patientName" TEXT NOT NULL,
    "gender" TEXT,
    "age" INTEGER,
    "address" TEXT,
    "tpaName" TEXT,
    "insuranceName" TEXT,
    "doctorName" TEXT,
    "visitType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "apptAt" DATETIME NOT NULL,
    "testCode" TEXT,
    "testDescription" TEXT,
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Appointment_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Appointment_patientIdRef_fkey" FOREIGN KEY ("patientIdRef") REFERENCES "Patient" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Appointment" ("address", "age", "apptAt", "createdAt", "doctorName", "gender", "id", "insuranceName", "isActive", "labId", "mobile", "patientId", "patientName", "proposalNo", "source", "status", "testCode", "testDescription", "tpaName", "updatedAt", "visitType") SELECT "address", "age", "apptAt", "createdAt", "doctorName", "gender", "id", "insuranceName", "isActive", "labId", "mobile", "patientId", "patientName", "proposalNo", "source", "status", "testCode", "testDescription", "tpaName", "updatedAt", "visitType" FROM "Appointment";
DROP TABLE "Appointment";
ALTER TABLE "new_Appointment" RENAME TO "Appointment";
CREATE INDEX "Appointment_labId_idx" ON "Appointment"("labId");
CREATE INDEX "Appointment_status_idx" ON "Appointment"("status");
CREATE INDEX "Appointment_apptAt_idx" ON "Appointment"("apptAt");
CREATE INDEX "Appointment_tpaName_idx" ON "Appointment"("tpaName");
CREATE INDEX "Appointment_insuranceName_idx" ON "Appointment"("insuranceName");
CREATE TABLE "new_Lab" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Lab" ("address", "createdAt", "email", "id", "isActive", "labCode", "name", "phone", "updatedAt") SELECT "address", "createdAt", "email", "id", "isActive", "labCode", "name", "phone", "updatedAt" FROM "Lab";
DROP TABLE "Lab";
ALTER TABLE "new_Lab" RENAME TO "Lab";
CREATE UNIQUE INDEX "Lab_labCode_key" ON "Lab"("labCode");
CREATE TABLE "new_PasswordSetupToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordSetupToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PasswordSetupToken" ("createdAt", "expiresAt", "id", "token", "userId") SELECT "createdAt", "expiresAt", "id", "token", "userId" FROM "PasswordSetupToken";
DROP TABLE "PasswordSetupToken";
ALTER TABLE "new_PasswordSetupToken" RENAME TO "PasswordSetupToken";
CREATE UNIQUE INDEX "PasswordSetupToken_token_key" ON "PasswordSetupToken"("token");
CREATE INDEX "PasswordSetupToken_userId_idx" ON "PasswordSetupToken"("userId");
CREATE TABLE "new_Patient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tpaName" TEXT,
    "insuranceName" TEXT,
    "doctorName" TEXT,
    "address" TEXT,
    "phone" TEXT NOT NULL,
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Patient_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Patient" ("address", "createdAt", "doctorName", "id", "insuranceName", "isActive", "labId", "name", "patientId", "phone", "tpaName", "updatedAt") SELECT "address", "createdAt", "doctorName", "id", "insuranceName", "isActive", "labId", "name", "patientId", "phone", "tpaName", "updatedAt" FROM "Patient";
DROP TABLE "Patient";
ALTER TABLE "new_Patient" RENAME TO "Patient";
CREATE INDEX "Patient_labId_idx" ON "Patient"("labId");
CREATE INDEX "Patient_phone_idx" ON "Patient"("phone");
CREATE UNIQUE INDEX "Patient_labId_patientId_key" ON "Patient"("labId", "patientId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "email" TEXT,
    "dob" DATETIME,
    "address" TEXT,
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_User" ("address", "createdAt", "dob", "email", "id", "isActive", "labId", "name", "password", "phone", "role", "updatedAt", "userId") SELECT "address", "createdAt", "dob", "email", "id", "isActive", "labId", "name", "password", "phone", "role", "updatedAt", "userId" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE INDEX "User_labId_idx" ON "User"("labId");
CREATE INDEX "User_phone_idx" ON "User"("phone");
CREATE UNIQUE INDEX "User_labId_userId_key" ON "User"("labId", "userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "InsuranceCompany_vendorId_idx" ON "InsuranceCompany"("vendorId");

-- CreateIndex
CREATE INDEX "InsuranceCompany_name_idx" ON "InsuranceCompany"("name");
