/*
  Warnings:

  - You are about to drop the column `address` on the `Appointment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Appointment" DROP COLUMN "address",
ADD COLUMN     "paymentDate" TIMESTAMP(3),
ADD COLUMN     "serviceType" TEXT;
