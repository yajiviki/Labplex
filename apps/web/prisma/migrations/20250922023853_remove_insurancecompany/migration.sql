/*
  Warnings:

  - You are about to drop the `InsuranceCompany` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX "Vendor_vendorId_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "InsuranceCompany";
PRAGMA foreign_keys=on;
