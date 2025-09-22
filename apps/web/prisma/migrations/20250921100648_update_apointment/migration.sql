/*
  Warnings:

  - You are about to drop the column `insuranceVendorId` on the `Appointment` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `Appointment` table. All the data in the column will be lost.
  - You are about to drop the column `tatHours` on the `Appointment` table. All the data in the column will be lost.
  - Added the required column `mobile` to the `Appointment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `patientName` to the `Appointment` table without a default value. This is not possible if the table is not empty.
  - Made the column `patientId` on table `Appointment` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Appointment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "proposalNo" TEXT,
    "patientId" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "gender" TEXT,
    "age" INTEGER,
    "address" TEXT,
    "tpaName" TEXT,
    "insuranceName" TEXT,
    "doctorName" TEXT,
    "visitType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'BOOKED',
    "mobile" TEXT NOT NULL,
    "apptAt" DATETIME NOT NULL,
    "testCode" TEXT,
    "testDescription" TEXT,
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Appointment_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Appointment" ("apptAt", "createdAt", "doctorName", "id", "isActive", "labId", "patientId", "source", "status", "updatedAt", "visitType") SELECT "apptAt", "createdAt", "doctorName", "id", "isActive", "labId", "patientId", "source", "status", "updatedAt", "visitType" FROM "Appointment";
DROP TABLE "Appointment";
ALTER TABLE "new_Appointment" RENAME TO "Appointment";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
