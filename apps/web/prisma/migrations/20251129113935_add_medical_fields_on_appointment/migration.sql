/*
  Warnings:

  - You are about to drop the column `applicationForm` on the `Appointment` table. All the data in the column will be lost.
  - You are about to drop the column `bloodTest` on the `Appointment` table. All the data in the column will be lost.
  - You are about to drop the column `ecg` on the `Appointment` table. All the data in the column will be lost.
  - You are about to drop the column `urineTest` on the `Appointment` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "BloodTestKind" AS ENUM ('FB', 'B');

-- CreateEnum
CREATE TYPE "ApplicationFormKind" AS ENUM ('MER', 'FMR');

-- AlterTable
ALTER TABLE "Appointment" DROP COLUMN "applicationForm",
DROP COLUMN "bloodTest",
DROP COLUMN "ecg",
DROP COLUMN "urineTest";

-- CreateTable
CREATE TABLE "AppointmentTests" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "bloodTest" "BloodTestKind" NOT NULL DEFAULT 'FB',
    "urineTest" BOOLEAN NOT NULL DEFAULT false,
    "ecg" BOOLEAN NOT NULL DEFAULT false,
    "applicationForm" "ApplicationFormKind" NOT NULL DEFAULT 'MER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentTests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentTests_appointmentId_key" ON "AppointmentTests"("appointmentId");

-- CreateIndex
CREATE INDEX "AppointmentTests_appointmentId_idx" ON "AppointmentTests"("appointmentId");

-- AddForeignKey
ALTER TABLE "AppointmentTests" ADD CONSTRAINT "AppointmentTests_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
