-- CreateEnum
CREATE TYPE "UsageInvoiceStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED');

-- AlterTable
ALTER TABLE "UsageInvoice" ADD COLUMN     "asaasPaymentId" TEXT,
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "invoiceUrl" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "status" "UsageInvoiceStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "Organisation" ADD COLUMN     "billingDocument" TEXT,
ADD COLUMN     "billingEmail" TEXT,
ADD COLUMN     "billingName" TEXT;

-- CreateTable
CREATE TABLE "UsageInvoiceItem" (
    "id" TEXT NOT NULL,
    "usageInvoiceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,

    CONSTRAINT "UsageInvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AsaasWebhookEvent" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AsaasWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UsageInvoiceItem_usageInvoiceId_idx" ON "UsageInvoiceItem"("usageInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "UsageInvoice_asaasPaymentId_key" ON "UsageInvoice"("asaasPaymentId");

-- AddForeignKey
ALTER TABLE "UsageInvoiceItem" ADD CONSTRAINT "UsageInvoiceItem_usageInvoiceId_fkey" FOREIGN KEY ("usageInvoiceId") REFERENCES "UsageInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

