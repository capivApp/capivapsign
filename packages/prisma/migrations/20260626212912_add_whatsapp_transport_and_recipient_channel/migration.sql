-- CreateEnum
CREATE TYPE "RecipientDeliveryChannel" AS ENUM ('EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "WhatsappTransportType" AS ENUM ('ZAPI');

-- AlterTable
ALTER TABLE "OrganisationClaim" ADD COLUMN     "whatsappTransportId" TEXT;

-- AlterTable
ALTER TABLE "Recipient" ADD COLUMN     "deliveryChannel" "RecipientDeliveryChannel" NOT NULL DEFAULT 'EMAIL',
ADD COLUMN     "phone" VARCHAR(32);

-- AlterTable
ALTER TABLE "SubscriptionClaim" ADD COLUMN     "whatsappTransportId" TEXT;

-- CreateTable
CREATE TABLE "WhatsappTransport" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "type" "WhatsappTransportType" NOT NULL,
    "fromName" TEXT NOT NULL,
    "config" TEXT NOT NULL,

    CONSTRAINT "WhatsappTransport_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SubscriptionClaim" ADD CONSTRAINT "SubscriptionClaim_whatsappTransportId_fkey" FOREIGN KEY ("whatsappTransportId") REFERENCES "WhatsappTransport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganisationClaim" ADD CONSTRAINT "OrganisationClaim_whatsappTransportId_fkey" FOREIGN KEY ("whatsappTransportId") REFERENCES "WhatsappTransport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
