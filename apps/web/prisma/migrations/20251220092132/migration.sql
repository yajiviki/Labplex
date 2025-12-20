/*
  Warnings:

  - The values [NONE] on the enum `BloodTestType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
ALTER TYPE "ApplicationForm" ADD VALUE 'ALL';

-- AlterEnum
BEGIN;
CREATE TYPE "BloodTestType_new" AS ENUM ('No', 'FB', 'B');
ALTER TABLE "public"."AppointmentTests" ALTER COLUMN "bloodTest" DROP DEFAULT;
ALTER TABLE "AppointmentTests" ALTER COLUMN "bloodTest" TYPE "BloodTestType_new" USING ("bloodTest"::text::"BloodTestType_new");
ALTER TYPE "BloodTestType" RENAME TO "BloodTestType_old";
ALTER TYPE "BloodTestType_new" RENAME TO "BloodTestType";
DROP TYPE "public"."BloodTestType_old";
ALTER TABLE "AppointmentTests" ALTER COLUMN "bloodTest" SET DEFAULT 'No';
COMMIT;

-- AlterTable
ALTER TABLE "AppointmentTests" ALTER COLUMN "bloodTest" SET DEFAULT 'No';

-- DropEnum
DROP TYPE "public"."ApplicationFormKind";

-- DropEnum
DROP TYPE "public"."BloodTestKind";
