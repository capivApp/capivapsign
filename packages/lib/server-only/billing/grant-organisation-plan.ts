import { prisma } from '@documenso/prisma';
import { SubscriptionStatus } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { applyOrganisationPlan, findBillingOrganisation } from './change-organisation-plan';

export type GrantOrganisationPlanOptions = {
  organisationId: string;
  claimId: string;
  /** 0 to 100, taken off every monthly bill. */
  discountPercent: number;
};

/**
 * Admin grant: puts the organisation on any plan right away (unpriced ones
 * included, no billing details needed) with a standing discount. Bills keep
 * being issued with the full amounts and the discount line; at 100% they are
 * never charged.
 */
export const grantOrganisationPlan = async ({
  organisationId,
  claimId,
  discountPercent,
}: GrantOrganisationPlanOptions) => {
  if (!Number.isInteger(discountPercent) || discountPercent < 0 || discountPercent > 100) {
    throw new AppError(AppErrorCode.INVALID_BODY, { message: 'Discount must be an integer from 0 to 100' });
  }

  const [organisation, plan] = await Promise.all([
    findBillingOrganisation(organisationId),
    prisma.subscriptionClaim.findUnique({ where: { id: claimId } }),
  ]);

  if (!plan) {
    throw new AppError(AppErrorCode.NOT_FOUND, { message: `Plan ${claimId} not found` });
  }

  await applyOrganisationPlan(organisation, plan);

  await prisma.subscription.upsert({
    where: { organisationId },
    create: { organisationId, status: SubscriptionStatus.ACTIVE, discountPercent },
    update: { discountPercent },
  });
};
