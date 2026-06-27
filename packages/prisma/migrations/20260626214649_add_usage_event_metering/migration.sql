-- CreateEnum
CREATE TYPE "BillableEventType" AS ENUM ('CREATE_DOCUMENT', 'RECOVER_FILE', 'WHATSAPP_MESSAGE', 'WEBHOOK_DELIVERY', 'EMAIL_MESSAGE');

-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "teamId" INTEGER,
    "userId" INTEGER,
    "apiTokenId" INTEGER,
    "type" "BillableEventType" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPriceCents" INTEGER NOT NULL DEFAULT 0,
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UsageEvent_organisationId_createdAt_idx" ON "UsageEvent"("organisationId", "createdAt");

-- CreateIndex
CREATE INDEX "UsageEvent_organisationId_type_createdAt_idx" ON "UsageEvent"("organisationId", "type", "createdAt");

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
