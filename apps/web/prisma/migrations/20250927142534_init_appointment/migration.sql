/*
  Warnings:

  - A unique constraint covering the columns `[clientRef,apptAt]` on the table `Appointment` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Appointment_clientRef_apptAt_key" ON "public"."Appointment"("clientRef", "apptAt");
