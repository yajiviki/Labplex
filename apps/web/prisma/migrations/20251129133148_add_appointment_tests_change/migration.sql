/*
  Warnings:

  - The values [R] on the enum `BloodTestKind` will be removed. If these variants are still used in the database, this will fail.
  - The values [R] on the enum `BloodTestType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "BloodTestKind_new" AS ENUM ('FB', 'B');
ALTER TYPE "BloodTestKind" RENAME TO "BloodTestKind_old";
ALTER TYPE "BloodTestKind_new" RENAME TO "BloodTestKind";
DROP TYPE "public"."BloodTestKind_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "BloodTestType_new" AS ENUM ('NONE', 'FB', 'B');
ALTER TABLE "public"."AppointmentTests" ALTER COLUMN "bloodTest" DROP DEFAULT;
ALTER TABLE "AppointmentTests" ALTER COLUMN "bloodTest" TYPE "BloodTestType_new" USING ("bloodTest"::text::"BloodTestType_new");
ALTER TYPE "BloodTestType" RENAME TO "BloodTestType_old";
ALTER TYPE "BloodTestType_new" RENAME TO "BloodTestType";
DROP TYPE "public"."BloodTestType_old";
ALTER TABLE "AppointmentTests" ALTER COLUMN "bloodTest" SET DEFAULT 'NONE';
COMMIT;
