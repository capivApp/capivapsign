-- CreateTable
CREATE TABLE "UsageInvoice" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "monthlyPriceCents" INTEGER NOT NULL DEFAULT 0,
    "meteredCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "stripeInvoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UsageInvoice_organisationId_idx" ON "UsageInvoice"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "UsageInvoice_organisationId_period_key" ON "UsageInvoice"("organisationId", "period");

-- AddForeignKey
ALTER TABLE "UsageInvoice" ADD CONSTRAINT "UsageInvoice_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
