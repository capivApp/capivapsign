-- CreateEnum
CREATE TYPE "MessageTemplateChannel" AS ENUM ('EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "MessageTemplateEvent" AS ENUM ('SIGNING_REQUEST');

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organisationId" TEXT NOT NULL,
    "channel" "MessageTemplateChannel" NOT NULL,
    "event" "MessageTemplateEvent" NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MessageTemplate_organisationId_idx" ON "MessageTemplate"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_organisationId_channel_event_key" ON "MessageTemplate"("organisationId", "channel", "event");

-- AddForeignKey
ALTER TABLE "MessageTemplate" ADD CONSTRAINT "MessageTemplate_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
