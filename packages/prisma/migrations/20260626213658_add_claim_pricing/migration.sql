-- AlterTable
ALTER TABLE "OrganisationClaim" ADD COLUMN     "pricing" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "SubscriptionClaim" ADD COLUMN     "pricing" JSONB NOT NULL DEFAULT '{}';
