import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { INTERNAL_CLAIM_ID } from '@documenso/lib/types/subscription';
import { prisma } from '@documenso/prisma';
import { DocumentSource, EnvelopeType, SubscriptionStatus } from '@prisma/client';
import { DateTime } from 'luxon';

import { FREE_PLAN_LIMITS, PAID_PLAN_LIMITS, SELFHOSTED_PLAN_LIMITS } from './constants';
import { ERROR_CODES } from './errors';
import type { TLimitsResponseSchema } from './schema';

export type GetServerLimitsOptions = {
  userId: number;
  teamId: number;
};

export const getServerLimits = async ({ userId, teamId }: GetServerLimitsOptions): Promise<TLimitsResponseSchema> => {
  const organisation = await prisma.organisation.findFirst({
    where: {
      teams: {
        some: {
          id: teamId,
        },
      },
      members: {
        some: {
          userId,
        },
      },
    },
    include: {
      subscription: true,
      organisationClaim: true,
    },
  });

  if (!organisation) {
    throw new Error(ERROR_CODES.USER_FETCH_FAILED);
  }

  const quota = structuredClone(FREE_PLAN_LIMITS);
  const remaining = structuredClone(FREE_PLAN_LIMITS);

  const subscription = organisation.subscription;
  const maximumEnvelopeItemCount = organisation.organisationClaim.envelopeItemCount;

  if (!IS_BILLING_ENABLED()) {
    return {
      quota: SELFHOSTED_PLAN_LIMITS,
      remaining: SELFHOSTED_PLAN_LIMITS,
      maximumEnvelopeItemCount,
    };
  }

  const { originalSubscriptionClaimId, flags } = organisation.organisationClaim;

  // Enterprise is never limited, not even with an overdue bill.
  if (originalSubscriptionClaimId === INTERNAL_CLAIM_ID.ENTERPRISE) {
    return {
      quota: PAID_PLAN_LIMITS,
      remaining: PAID_PLAN_LIMITS,
      maximumEnvelopeItemCount,
    };
  }

  // An overdue bill marks the subscription INACTIVE: the organisation keeps
  // working within the free plan's limits until it pays.
  const isOverdue = subscription?.status === SubscriptionStatus.INACTIVE;

  // Unlimited documents claim, which also applies to "free" claims that carry it.
  if (flags.unlimitedDocuments && !isOverdue) {
    return {
      quota: PAID_PLAN_LIMITS,
      remaining: PAID_PLAN_LIMITS,
      maximumEnvelopeItemCount,
    };
  }

  const [documents, directTemplates] = await Promise.all([
    prisma.envelope.count({
      where: {
        type: EnvelopeType.DOCUMENT,
        team: {
          organisationId: organisation.id,
        },
        createdAt: {
          gte: DateTime.utc().startOf('month').toJSDate(),
        },
        source: {
          not: DocumentSource.TEMPLATE_DIRECT_LINK,
        },
      },
    }),
    prisma.envelope.count({
      where: {
        type: EnvelopeType.TEMPLATE,
        team: {
          organisationId: organisation.id,
        },
        directLink: {
          isNot: null,
        },
      },
    }),
  ]);

  remaining.documents = Math.max(remaining.documents - documents, 0);
  remaining.directTemplates = Math.max(remaining.directTemplates - directTemplates, 0);

  return {
    quota,
    remaining,
    maximumEnvelopeItemCount,
  };
};
