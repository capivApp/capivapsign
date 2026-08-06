import { stripe } from '@documenso/lib/server-only/stripe';
import { INTERNAL_CLAIM_ID, type InternalClaim, internalClaims } from '@documenso/lib/types/subscription';
import { formatStripePrice } from '@documenso/lib/universal/stripe/to-human-price';
import { clone } from 'remeda';
import type Stripe from 'stripe';

export type InternalClaimPlans = {
  [key in INTERNAL_CLAIM_ID]: InternalClaim & {
    monthlyPrice?: Stripe.Price & {
      product: Stripe.Product;
      isVisibleInApp: boolean;
      friendlyPrice: string;
    };
    yearlyPrice?: Stripe.Price & {
      product: Stripe.Product;
      isVisibleInApp: boolean;
      friendlyPrice: string;
    };
  };
};

/**
 * Returns the main CapivaSign plans from Stripe.
 */
export const getInternalClaimPlans = async (): Promise<InternalClaimPlans> => {
  const { data: prices } = await stripe.prices.search({
    query: `active:'true' type:'recurring'`,
    expand: ['data.product'],
    limit: 100,
  });

  const plans: InternalClaimPlans = clone(internalClaims);

  prices.forEach((price) => {
    // We use `expand` to get the product, but it's not typed as part of the Price type.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const product = price.product as Stripe.Product;

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const productClaimId = product.metadata.claimId as INTERNAL_CLAIM_ID | undefined;
    const isVisibleInApp = price.metadata.visibleInApp === 'true';

    if (!productClaimId || !Object.values(INTERNAL_CLAIM_ID).includes(productClaimId)) {
      return;
    }

    // Seat-based plans quote the per-seat rate, since the total depends on how
    // many members the organisation ends up with. Stripe's `unit_amount` on a
    // per-seat price already IS that rate, so it needs no special casing —
    // reading it from the price keeps the displayed number tied to what Stripe
    // will actually charge.
    const friendlyPrice = formatStripePrice(price.unit_amount ?? 0, price.currency);

    if (price.recurring?.interval === 'month') {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      plans[productClaimId].monthlyPrice = {
        ...price,
        isVisibleInApp,
        product,
        friendlyPrice,
      };
    }

    if (price.recurring?.interval === 'year') {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      plans[productClaimId].yearlyPrice = {
        ...price,
        isVisibleInApp,
        product,
        friendlyPrice,
      };
    }
  });

  return plans;
};
