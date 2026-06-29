import { prisma } from '@documenso/prisma';
import type { TClaimFlags, TClaimPricing } from '../../types/subscription';
import { ZClaimFlagsSchema, ZClaimPricingSchema } from '../../types/subscription';

export type PublicPricingClaim = {
  id: string;
  name: string;
  pricing: TClaimPricing;
  flags: TClaimFlags;
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
    select: { id: true, name: true, pricing: true, flags: true },
  });

  return claims
    .map((claim) => ({
      id: claim.id,
      name: claim.name,
      pricing: ZClaimPricingSchema.parse(claim.pricing ?? {}),
      flags: ZClaimFlagsSchema.parse(claim.flags ?? {}),
    }))
    .filter((claim) => Object.values(claim.pricing).some((cents) => typeof cents === 'number'));
};
