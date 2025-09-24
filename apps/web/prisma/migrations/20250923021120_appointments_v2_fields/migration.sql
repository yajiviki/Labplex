/*
  Warnings:

  - You are about to drop the column `doctorName` on the `Appointment` table. All the data in the column will be lost.
  - You are about to drop the column `insuranceName` on the `Appointment` table. All the data in the column will be lost.
  - You are about to drop the column `mobile` on the `Appointment` table. All the data in the column will be lost.
  - You are about to drop the column `patientIdRef` on the `Appointment` table. All the data in the column will be lost.
  - You are about to drop the column `patientName` on the `Appointment` table. All the data in the column will be lost.
  - You are about to drop the column `proposalNo` on the `Appointment` table. All the data in the column will be lost.
  - You are about to drop the column `source` on the `Appointment` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Appointment` table. All the data in the column will be lost.
  - You are about to drop the column `testCode` on the `Appointment` table. All the data in the column will be lost.
  - You are about to drop the column `testDescription` on the `Appointment` table. All the data in the column will be lost.
  - You are about to drop the column `tpaName` on the `Appointment` table. All the data in the column will be lost.
  - Added the required column `clientName` to the `Appointment` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Appointment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "apptAt" DATETIME NOT NULL,
    "patientId" TEXT,
    "vendorId" TEXT,
    "labId" TEXT,
    "insuranceCompanyId" TEXT,
    "clientName" TEXT NOT NULL,
    "clientRef" TEXT,
    "gender" TEXT,
    "age" INTEGER,
    "address" TEXT,
    "phone" TEXT,
    "visitType" TEXT,
    "location" TEXT,
    "medicalStatus" TEXT,
    "reportStatus" TEXT,
    "extraChargeRs" INTEGER,
    "paymentStatus" TEXT,
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Appointment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Appointment_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Appointment_insuranceCompanyId_fkey" FOREIGN KEY ("insuranceCompanyId") REFERENCES "InsuranceCompany" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Appointment" ("address", "age", "apptAt", "createdAt", "gender", "id", "isActive", "labId", "patientId", "updatedAt", "visitType") SELECT "address", "age", "apptAt", "createdAt", "gender", "id", "isActive", "labId", "patientId", "updatedAt", "visitType" FROM "Appointment";
DROP TABLE "Appointment";
ALTER TABLE "new_Appointment" RENAME TO "Appointment";
CREATE INDEX "Appointment_apptAt_idx" ON "Appointment"("apptAt");
CREATE INDEX "Appointment_patientId_idx" ON "Appointment"("patientId");
CREATE INDEX "Appointment_vendorId_idx" ON "Appointment"("vendorId");
CREATE INDEX "Appointment_labId_idx" ON "Appointment"("labId");
CREATE INDEX "Appointment_insuranceCompanyId_idx" ON "Appointment"("insuranceCompanyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "InsuranceCompany_name_idx" ON "InsuranceCompany"("name");

-- CreateIndex
CREATE INDEX "Vendor_tpaName_idx" ON "Vendor"("tpaName");
