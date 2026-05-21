-- AlterTable: tokens OAuth Mercado Pago para split marketplace
ALTER TABLE "users" ADD COLUMN "mercadoPagoAccessToken" TEXT;
ALTER TABLE "users" ADD COLUMN "mercadoPagoRefreshToken" TEXT;
ALTER TABLE "users" ADD COLUMN "mercadoPagoTokenExpiresAt" TIMESTAMP(3);
