-- CreateEnum
CREATE TYPE "BillingStatus" AS ENUM ('Paid', 'NotPaid');

-- CreateTable
CREATE TABLE "Billing" (
    "id" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "paidDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "BillingStatus" NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Billing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Billing_labId_vendorId_paidDate_idx" ON "Billing"("labId", "vendorId", "paidDate");

-- AddForeignKey
ALTER TABLE "Billing" ADD CONSTRAINT "Billing_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Billing" ADD CONSTRAINT "Billing_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
