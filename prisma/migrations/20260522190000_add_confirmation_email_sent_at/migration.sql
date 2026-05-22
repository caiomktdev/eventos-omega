-- AlterTable: rastreia envio do e-mail de confirmação de ingresso (idempotência)
ALTER TABLE "participants" ADD COLUMN "confirmationEmailSentAt" TIMESTAMP(3);
