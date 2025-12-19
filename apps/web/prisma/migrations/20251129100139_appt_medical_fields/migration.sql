-- CreateEnum
CREATE TYPE "BloodTestType" AS ENUM ('NONE', 'FB', 'B');

-- CreateEnum
CREATE TYPE "ApplicationForm" AS ENUM ('MER', 'FMR');

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "applicationForm" "ApplicationForm",
ADD COLUMN     "bloodTest" "BloodTestType" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "ecg" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "urineTest" BOOLEAN NOT NULL DEFAULT false;
