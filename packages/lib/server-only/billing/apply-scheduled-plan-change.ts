import { prisma } from '@documenso/prisma';

import { createOrganisationClaimUpsertData } from '../organisation/create-organisation';

export type ApplyScheduledPlanChangeOptions = {
  organisationId: string;
  now?: Date;
};

/**
 * Applies a downgrade scheduled by changeOrganisationPlan once its date has
 * come. The monthly sweep calls it right after billing the month, so that month
 * is charged at the plan the organisation actually had.
 */
export const applyScheduledPlanChange = async ({
  organisationId,
  now = new Date(),
}: ApplyScheduledPlanChangeOptions) => {
  const subscription = await prisma.subscription.findUnique({
    where: { organisationId },
    select: { scheduledClaimId: true, scheduledAt: true },
  });

  const { scheduledClaimId, scheduledAt } = subscription ?? {};

  if (!scheduledClaimId || !scheduledAt || scheduledAt > now) {
    return;
  }

  const [plan, organisation] = await Promise.all([
    prisma.subscriptionClaim.findUnique({ where: { id: scheduledClaimId } }),
    prisma.organisation.findUniqueOrThrow({ where: { id: organisationId }, select: { organisationClaimId: true } }),
  ]);

  await prisma.$transaction(async (tx) => {
    // A plan deleted by an admin in the meantime just drops the schedule.
    if (plan) {
      await tx.organisationClaim.update({
        where: { id: organisation.organisationClaimId },
        data: { originalSubscriptionClaimId: plan.id, ...createOrganisationClaimUpsertData(plan) },
      });
    }

    await tx.subscription.update({
      where: { organisationId },
      data: { scheduledClaimId: null, scheduledAt: null },
    });
  });
};
