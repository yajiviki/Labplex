-- AlterTable
ALTER TABLE "public"."Appointment" ALTER COLUMN "extraChargeRs" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "public"."InsuranceCompany" ADD COLUMN     "nickName" TEXT;

-- AlterTable
ALTER TABLE "public"."Lab" ADD COLUMN     "nickName" TEXT;

-- AlterTable
ALTER TABLE "public"."Vendor" ADD COLUMN     "nickName" TEXT;
