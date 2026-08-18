-- AlterTable
ALTER TABLE "transactions" ADD COLUMN "reservationExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "transactions_status_reservationExpiresAt_idx" ON "transactions"("status", "reservationExpiresAt");
