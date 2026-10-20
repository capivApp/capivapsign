-- Billing moved from Stripe to Asaas and nobody was paying through Stripe yet.
-- Stripe customer ids and Stripe-synced subscription rows mean nothing to
-- Asaas: a stale INACTIVE row would keep an organisation on free plan limits
-- with no overdue bill to clear it. Organisations get a fresh row on their
-- first paid plan or first bill.
DELETE FROM "Subscription";
UPDATE "Organisation" SET "customerId" = NULL WHERE "customerId" IS NOT NULL;

-- AlterEnum
ALTER TYPE "UsageInvoiceStatus" ADD VALUE 'WAIVED';

-- DropIndex
DROP INDEX "Subscription_planId_key";

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "cancelAtPeriodEnd",
DROP COLUMN "customerId",
DROP COLUMN "periodEnd",
DROP COLUMN "planId",
DROP COLUMN "priceId",
ADD COLUMN     "discountPercent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "scheduledAt" TIMESTAMP(3),
ADD COLUMN     "scheduledClaimId" TEXT;

-- AlterTable
ALTER TABLE "UsageInvoice" DROP COLUMN "stripeInvoiceId";

