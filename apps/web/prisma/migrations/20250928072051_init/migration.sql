/*
  Warnings:

  - You are about to drop the column `patientId` on the `Appointment` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Appointment" DROP CONSTRAINT "Appointment_patientId_fkey";

-- AlterTable
ALTER TABLE "public"."Appointment" DROP COLUMN "patientId";
