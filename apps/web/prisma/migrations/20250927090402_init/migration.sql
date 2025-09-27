-- CreateTable
CREATE TABLE "public"."Lab" (
    "id" TEXT NOT NULL,
    "labCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "email" TEXT,
    "dob" TIMESTAMP(3),
    "address" TEXT,
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PasswordSetupToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordSetupToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Vendor" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "tpaName" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LabVendor" (
    "labId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,

    CONSTRAINT "LabVendor_pkey" PRIMARY KEY ("labId","vendorId")
);

-- CreateTable
CREATE TABLE "public"."InsuranceCompany" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Patient" (
    "id" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tpaName" TEXT,
    "insuranceName" TEXT,
    "doctorName" TEXT,
    "address" TEXT,
    "phone" TEXT NOT NULL,
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Appointment" (
    "id" TEXT NOT NULL,
    "apptAt" TIMESTAMP(3) NOT NULL,
    "vendorId" TEXT,
    "labId" TEXT,
    "insuranceCompanyId" TEXT,
    "clientName" TEXT NOT NULL,
    "clientRef" TEXT,
    "gender" TEXT,
    "age" INTEGER,
    "address" TEXT,
    "phone" TEXT,
    "visitType" TEXT,
    "location" TEXT,
    "status" TEXT,
    "extraChargeRs" INTEGER,
    "paymentStatus" TEXT,
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "patientId" TEXT,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lab_labCode_key" ON "public"."Lab"("labCode");

-- CreateIndex
CREATE UNIQUE INDEX "User_userId_key" ON "public"."User"("userId");

-- CreateIndex
CREATE INDEX "User_labId_idx" ON "public"."User"("labId");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "public"."User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordSetupToken_token_key" ON "public"."PasswordSetupToken"("token");

-- CreateIndex
CREATE INDEX "PasswordSetupToken_userId_idx" ON "public"."PasswordSetupToken"("userId");

-- CreateIndex
CREATE INDEX "Vendor_tpaName_idx" ON "public"."Vendor"("tpaName");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_vendorId_key" ON "public"."Vendor"("vendorId");

-- CreateIndex
CREATE INDEX "LabVendor_vendorId_idx" ON "public"."LabVendor"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceCompany_code_key" ON "public"."InsuranceCompany"("code");

-- CreateIndex
CREATE INDEX "InsuranceCompany_name_idx" ON "public"."InsuranceCompany"("name");

-- CreateIndex
CREATE INDEX "Patient_labId_idx" ON "public"."Patient"("labId");

-- CreateIndex
CREATE INDEX "Patient_phone_idx" ON "public"."Patient"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_labId_patientId_key" ON "public"."Patient"("labId", "patientId");

-- CreateIndex
CREATE INDEX "Appointment_apptAt_idx" ON "public"."Appointment"("apptAt");

-- CreateIndex
CREATE INDEX "Appointment_vendorId_idx" ON "public"."Appointment"("vendorId");

-- CreateIndex
CREATE INDEX "Appointment_labId_idx" ON "public"."Appointment"("labId");

-- CreateIndex
CREATE INDEX "Appointment_insuranceCompanyId_idx" ON "public"."Appointment"("insuranceCompanyId");

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_labId_fkey" FOREIGN KEY ("labId") REFERENCES "public"."Lab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PasswordSetupToken" ADD CONSTRAINT "PasswordSetupToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LabVendor" ADD CONSTRAINT "LabVendor_labId_fkey" FOREIGN KEY ("labId") REFERENCES "public"."Lab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LabVendor" ADD CONSTRAINT "LabVendor_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Patient" ADD CONSTRAINT "Patient_labId_fkey" FOREIGN KEY ("labId") REFERENCES "public"."Lab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Appointment" ADD CONSTRAINT "Appointment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Appointment" ADD CONSTRAINT "Appointment_labId_fkey" FOREIGN KEY ("labId") REFERENCES "public"."Lab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Appointment" ADD CONSTRAINT "Appointment_insuranceCompanyId_fkey" FOREIGN KEY ("insuranceCompanyId") REFERENCES "public"."InsuranceCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
