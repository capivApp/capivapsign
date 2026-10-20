import { prisma } from '@documenso/prisma';

import {
  INTERNAL_CLAIM_ID,
  type TClaimFlags,
  type TClaimPricing,
  ZClaimFlagsSchema,
  ZClaimPricingSchema,
} from '../../types/subscription';

export type BillingPlan = {
  id: string;
  name: string;
  monthlyPriceCents: number;
  pricing: TClaimPricing;
  flags: TClaimFlags;
  teamCount: number;
  memberCount: number;
};

const isOffered = (plan: BillingPlan) => plan.id === INTERNAL_CLAIM_ID.FREE || plan.monthlyPriceCents > 0;

/**
 * Plans an organisation can pick in the app: the free plan plus every plan the
 * admin priced. Unpriced plans (enterprise, internal ones) are arranged by
 * contract and assigned by an admin instead.
 */
export const getBillingPlans = async (): Promise<BillingPlan[]> => {
  const claims = await prisma.subscriptionClaim.findMany({
    select: { id: true, name: true, pricing: true, flags: true, teamCount: true, memberCount: true },
  });

  return claims
    .map((claim) => {
      const pricing = ZClaimPricingSchema.parse(claim.pricing ?? {});

      return {
        id: claim.id,
        name: claim.name,
        monthlyPriceCents: pricing.monthlyPriceCents ?? 0,
        pricing,
        flags: ZClaimFlagsSchema.parse(claim.flags ?? {}),
        teamCount: claim.teamCount,
        memberCount: claim.memberCount,
      };
    })
    .filter(isOffered)
    .sort((a, b) => a.monthlyPriceCents - b.monthlyPriceCents);
};
