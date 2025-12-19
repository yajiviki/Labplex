/*
  Warnings:

  - The primary key for the `AppointmentTests` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `AppointmentTests` table. All the data in the column will be lost.
  - The `bloodTest` column on the `AppointmentTests` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `applicationForm` column on the `AppointmentTests` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- DropIndex
DROP INDEX "public"."AppointmentTests_appointmentId_idx";

-- DropIndex
DROP INDEX "public"."AppointmentTests_appointmentId_key";

-- AlterTable
ALTER TABLE "AppointmentTests" DROP CONSTRAINT "AppointmentTests_pkey",
DROP COLUMN "id",
DROP COLUMN "bloodTest",
ADD COLUMN     "bloodTest" "BloodTestType" NOT NULL DEFAULT 'NONE',
DROP COLUMN "applicationForm",
ADD COLUMN     "applicationForm" "ApplicationForm",
ADD CONSTRAINT "AppointmentTests_pkey" PRIMARY KEY ("appointmentId");
