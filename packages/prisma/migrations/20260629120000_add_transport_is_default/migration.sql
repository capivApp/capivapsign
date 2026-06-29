-- AlterTable
ALTER TABLE "EmailTransport" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "WhatsappTransport" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;
