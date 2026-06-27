import { prisma } from '@documenso/prisma';

import { ZClaimPricingSchema } from '../../types/subscription';
import type { TClaimPricing } from '../../types/subscription';

export type PublicPricingClaim = {
  id: string;
  name: string;
  pricing: TClaimPricing;
};

/**
 * Returns the subscription claim catalogue for the public marketing page.
 *
 * Only claims that have at least one metered price defined are returned, so
 * unpriced internal/self-hosted claims never leak onto the landing page.
 */
export const getPublicPricingClaims = async (): Promise<PublicPricingClaim[]> => {
  const claims = await prisma.subscriptionClaim.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, pricing: true },
  });

  return claims
    .map((claim) => ({
      id: claim.id,
      name: claim.name,
      pricing: ZClaimPricingSchema.parse(claim.pricing ?? {}),
    }))
    .filter((claim) => Object.values(claim.pricing).some((cents) => typeof cents === 'number'));
};
