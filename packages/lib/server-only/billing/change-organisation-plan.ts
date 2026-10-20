import { prisma } from '@documenso/prisma';
import { OrganisationType, type SubscriptionClaim, SubscriptionStatus } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { INTERNAL_CLAIM_ID, type TClaimPricing } from '../../types/subscription';
import { createOrganisationClaimUpsertData } from '../organisation/create-organisation';

export type ChangeOrganisationPlanOptions = {
  organisationId: string;
  claimId: string;
  now?: Date;
};

type PlanChange = { scheduledAt: Date | null };

export type BillingOrganisation = Awaited<ReturnType<typeof findBillingOrganisation>>;

const NO_SCHEDULE = { scheduledClaimId: null, scheduledAt: null };

// Personal organisations become regular ones on any plan beyond the
// individual tiers. Never demoted back.
const PERSONAL_PLAN_IDS: string[] = [INTERNAL_CLAIM_ID.FREE, INTERNAL_CLAIM_ID.INDIVIDUAL];

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const getMonthlyPriceCents = (pricing: unknown) => (pricing as TClaimPricing | null)?.monthlyPriceCents ?? 0;

const getFirstDayOfNextMonth = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

export const findBillingOrganisation = async (organisationId: string) =>
  prisma.organisation.findUniqueOrThrow({
    where: { id: organisationId },
    select: {
      id: true,
      type: true,
      customerId: true,
      organisationClaim: { select: { id: true, originalSubscriptionClaimId: true, pricing: true } },
    },
  });

const findOfferedPlan = async (claimId: string) => {
  const claim = await prisma.subscriptionClaim.findUnique({ where: { id: claimId } });

  if (!claim) {
    throw new AppError(AppErrorCode.NOT_FOUND, { message: `Plan ${claimId} not found` });
  }

  const isOffered = claim.id === INTERNAL_CLAIM_ID.FREE || getMonthlyPriceCents(claim.pricing) > 0;

  if (!isOffered) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, { message: `Plan ${claimId} is not offered in the app` });
  }

  return claim;
};

const requireBillingProfile = (organisation: BillingOrganisation, plan: SubscriptionClaim) => {
  if (getMonthlyPriceCents(plan.pricing) > 0 && !organisation.customerId) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'A paid plan requires the billing profile',
      userMessage: 'Preencha os dados de cobrança antes de escolher um plano pago.',
    });
  }
};

/**
 * Applies a plan to the organisation right away and drops any scheduled change.
 */
export const applyOrganisationPlan = async (
  organisation: BillingOrganisation,
  plan: SubscriptionClaim,
): Promise<PlanChange> => {
  const shouldPromote = organisation.type === OrganisationType.PERSONAL && !PERSONAL_PLAN_IDS.includes(plan.id);

  await prisma.$transaction(async (tx) => {
    await tx.organisationClaim.update({
      where: { id: organisation.organisationClaim.id },
      data: { originalSubscriptionClaimId: plan.id, ...createOrganisationClaimUpsertData(plan) },
    });

    await tx.subscription.upsert({
      where: { organisationId: organisation.id },
      create: { organisationId: organisation.id, status: SubscriptionStatus.ACTIVE },
      update: NO_SCHEDULE,
    });

    if (shouldPromote) {
      await tx.organisation.update({
        where: { id: organisation.id },
        data: { type: OrganisationType.ORGANISATION },
      });
    }
  });

  return { scheduledAt: null };
};

const keepCurrentPlan = async (organisation: BillingOrganisation): Promise<PlanChange> => {
  await prisma.subscription.upsert({
    where: { organisationId: organisation.id },
    create: { organisationId: organisation.id, status: SubscriptionStatus.ACTIVE },
    update: NO_SCHEDULE,
  });

  return { scheduledAt: null };
};

const schedulePlan = async (
  organisation: BillingOrganisation,
  plan: SubscriptionClaim,
  now: Date,
): Promise<PlanChange> => {
  const schedule = { scheduledClaimId: plan.id, scheduledAt: getFirstDayOfNextMonth(now) };

  await prisma.subscription.upsert({
    where: { organisationId: organisation.id },
    create: { organisationId: organisation.id, status: SubscriptionStatus.ACTIVE, ...schedule },
    update: schedule,
  });

  return { scheduledAt: schedule.scheduledAt };
};

/**
 * Moves an organisation to another plan. Billing is post-paid on the 1st, so:
 * - a pricier (or equally priced) plan applies now and is billed in full;
 * - a cheaper plan, including going back to free, waits for the 1st, after the
 *   month already used is billed at the current price;
 * - picking the current plan again cancels a scheduled change.
 */
export const changeOrganisationPlan = async ({
  organisationId,
  claimId,
  now = new Date(),
}: ChangeOrganisationPlanOptions): Promise<PlanChange> => {
  const [organisation, plan] = await Promise.all([findBillingOrganisation(organisationId), findOfferedPlan(claimId)]);

  requireBillingProfile(organisation, plan);

  if (organisation.organisationClaim.originalSubscriptionClaimId === plan.id) {
    return keepCurrentPlan(organisation);
  }

  const isDowngrade = getMonthlyPriceCents(plan.pricing) < getMonthlyPriceCents(organisation.organisationClaim.pricing);

  return isDowngrade ? schedulePlan(organisation, plan, now) : applyOrganisationPlan(organisation, plan);
};
