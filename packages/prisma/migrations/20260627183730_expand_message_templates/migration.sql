-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MessageTemplateEvent" ADD VALUE 'SIGNING_REMINDER';
ALTER TYPE "MessageTemplateEvent" ADD VALUE 'DOCUMENT_COMPLETED';
ALTER TYPE "MessageTemplateEvent" ADD VALUE 'DOCUMENT_REJECTED';
ALTER TYPE "MessageTemplateEvent" ADD VALUE 'DOCUMENT_CANCELLED';
ALTER TYPE "MessageTemplateEvent" ADD VALUE 'RECIPIENT_SIGNED';
ALTER TYPE "MessageTemplateEvent" ADD VALUE 'RECIPIENT_EXPIRED';
ALTER TYPE "MessageTemplateEvent" ADD VALUE 'OWNER_DOCUMENT_COMPLETED';
ALTER TYPE "MessageTemplateEvent" ADD VALUE 'DOCUMENT_CREATED_FROM_DIRECT_TEMPLATE';

-- CreateTable
CREATE TABLE "DefaultMessageTemplate" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "channel" "MessageTemplateChannel" NOT NULL,
    "event" "MessageTemplateEvent" NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,

    CONSTRAINT "DefaultMessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DefaultMessageTemplate_channel_event_key" ON "DefaultMessageTemplate"("channel", "event");
