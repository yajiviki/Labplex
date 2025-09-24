/*
  Warnings:

  - A unique constraint covering the columns `[vendorId]` on the table `Vendor` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE "InsuranceCompany" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InsuranceCompany_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "InsuranceCompany_vendorId_idx" ON "InsuranceCompany"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceCompany_vendorId_name_key" ON "InsuranceCompany"("vendorId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_vendorId_key" ON "Vendor"("vendorId");
