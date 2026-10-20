import { prisma } from '@documenso/prisma';
import { SubscriptionStatus } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FREE_PLAN_LIMITS, PAID_PLAN_LIMITS } from './constants';
import { getServerLimits } from './server';

vi.mock('@documenso/prisma', () => ({
  prisma: {
    organisation: { findFirst: vi.fn() },
    envelope: { count: vi.fn() },
  },
}));

type OrganisationOverrides = {
  claimId?: string;
  unlimitedDocuments?: boolean;
  subscriptionStatus?: SubscriptionStatus | null;
};

const mockOrganisation = ({
  claimId = 'team',
  unlimitedDocuments = true,
  subscriptionStatus = SubscriptionStatus.ACTIVE,
}: OrganisationOverrides) => {
  vi.mocked(prisma.organisation.findFirst).mockResolvedValue({
    id: 'org_1',
    type: 'ORGANISATION',
    organisationClaimId: 'org_claim_1',
    subscription: subscriptionStatus ? { status: subscriptionStatus } : null,
    organisationClaim: {
      originalSubscriptionClaimId: claimId,
      envelopeItemCount: 10,
      flags: { unlimitedDocuments },
    },
  } as never);
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_FEATURE_BILLING_ENABLED', 'true');
  vi.mocked(prisma.envelope.count).mockResolvedValue(2);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const getLimits = () => getServerLimits({ userId: 1, teamId: 1 });

describe('getServerLimits', () => {
  it('gives paid limits to a paid plan in good standing', async () => {
    mockOrganisation({});

    expect((await getLimits()).quota).toEqual(PAID_PLAN_LIMITS);
  });

  it('falls back to the free plan limits while a bill is overdue', async () => {
    mockOrganisation({ subscriptionStatus: SubscriptionStatus.INACTIVE });

    const limits = await getLimits();

    expect(limits.quota).toEqual(FREE_PLAN_LIMITS);
    expect(limits.remaining.documents).toBe(FREE_PLAN_LIMITS.documents - 2);
  });

  it('never limits enterprise plans, even with an overdue bill', async () => {
    mockOrganisation({
      claimId: 'enterprise',
      unlimitedDocuments: false,
      subscriptionStatus: SubscriptionStatus.INACTIVE,
    });

    expect((await getLimits()).quota).toEqual(PAID_PLAN_LIMITS);
  });

  it('counts free plan usage for the month', async () => {
    mockOrganisation({ claimId: 'free', unlimitedDocuments: false, subscriptionStatus: null });

    const limits = await getLimits();

    expect(limits.quota).toEqual(FREE_PLAN_LIMITS);
    expect(limits.remaining.documents).toBe(FREE_PLAN_LIMITS.documents - 2);
  });
});
