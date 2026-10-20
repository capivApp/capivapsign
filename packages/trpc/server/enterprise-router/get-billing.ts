import { getBillingPlans } from '@documenso/lib/server-only/billing/get-billing-plans';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import { ZGetBillingRequestSchema } from './get-billing.types';
import { requireBillingOrganisation } from './require-billing-organisation';

export const getBillingRoute = authenticatedProcedure.input(ZGetBillingRequestSchema).query(async ({ ctx, input }) => {
  const { organisationId } = input;

  ctx.logger.info({ input: { organisationId } });

  await requireBillingOrganisation({ organisationId, userId: ctx.user.id, permission: 'MANAGE_ORGANISATION' });

  const [organisation, plans] = await Promise.all([
    prisma.organisation.findUniqueOrThrow({
      where: { id: organisationId },
      select: {
        customerId: true,
        billingName: true,
        billingDocument: true,
        billingEmail: true,
        subscription: { select: { status: true, scheduledClaimId: true, scheduledAt: true, discountPercent: true } },
        organisationClaim: { select: { originalSubscriptionClaimId: true } },
      },
    }),
    getBillingPlans(),
  ]);

  return {
    plans,
    currentPlanId: organisation.organisationClaim.originalSubscriptionClaimId,
    subscription: organisation.subscription,
    hasBillingProfile: Boolean(organisation.customerId),
    billingProfile: {
      billingName: organisation.billingName ?? '',
      billingDocument: organisation.billingDocument ?? '',
      billingEmail: organisation.billingEmail ?? '',
    },
  };
});
