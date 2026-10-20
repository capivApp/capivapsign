import { prisma } from '@documenso/prisma';
import { OrganisationType, SubscriptionStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppErrorCode } from '../../errors/app-error';
import { changeOrganisationPlan } from './change-organisation-plan';

vi.mock('@documenso/prisma', () => {
  const client = {
    subscriptionClaim: { findUnique: vi.fn() },
    organisation: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
    organisationClaim: { update: vi.fn() },
    subscription: { upsert: vi.fn() },
    $transaction: vi.fn(),
  };

  client.$transaction.mockImplementation(async (callback: (tx: typeof client) => Promise<unknown>) => callback(client));

  return { prisma: client };
});

const NOW = new Date('2026-10-20T15:00:00Z');

const subscriptionClaim = (id: string, monthlyPriceCents?: number) => ({
  id,
  name: id,
  locked: false,
  teamCount: 1,
  memberCount: 5,
  envelopeItemCount: 5,
  recipientCount: 10,
  flags: {},
  pricing: monthlyPriceCents === undefined ? {} : { monthlyPriceCents },
  documentRateLimits: [],
  documentQuota: null,
  emailRateLimits: [],
  emailQuota: null,
  apiRateLimits: [],
  apiQuota: null,
  emailTransportId: null,
  whatsappTransportId: null,
});

const mockOrganisation = ({
  claimId = 'individual',
  monthlyPriceCents = 4990,
  customerId = 'cus_1' as string | null,
  type = OrganisationType.ORGANISATION as OrganisationType,
} = {}) => {
  vi.mocked(prisma.organisation.findUniqueOrThrow).mockResolvedValue({
    id: 'org_1',
    type,
    customerId,
    organisationClaim: { id: 'org_claim_1', originalSubscriptionClaimId: claimId, pricing: { monthlyPriceCents } },
  } as never);
};

const mockTarget = (id: string, monthlyPriceCents?: number) => {
  vi.mocked(prisma.subscriptionClaim.findUnique).mockResolvedValue(subscriptionClaim(id, monthlyPriceCents) as never);
};

const change = (claimId: string) => changeOrganisationPlan({ organisationId: 'org_1', claimId, now: NOW });

beforeEach(() => {
  vi.clearAllMocks();
  mockOrganisation();
});

describe('changeOrganisationPlan', () => {
  it('refuses plans that do not exist', async () => {
    vi.mocked(prisma.subscriptionClaim.findUnique).mockResolvedValue(null);

    await expect(change('missing')).rejects.toMatchObject({ code: AppErrorCode.NOT_FOUND });
  });

  it('refuses unpriced plans other than the free one', async () => {
    mockTarget('enterprise');

    await expect(change('enterprise')).rejects.toMatchObject({ code: AppErrorCode.INVALID_REQUEST });
  });

  it('asks for the billing details before a paid plan', async () => {
    mockOrganisation({ claimId: 'free', monthlyPriceCents: 0, customerId: null });
    mockTarget('team', 14990);

    await expect(change('team')).rejects.toMatchObject({
      code: AppErrorCode.INVALID_REQUEST,
      userMessage: 'Preencha os dados de cobrança antes de escolher um plano pago.',
    });
  });

  it('applies an upgrade right away and clears any scheduled change', async () => {
    mockTarget('team', 14990);

    const result = await change('team');

    expect(result).toEqual({ scheduledAt: null });
    expect(prisma.organisationClaim.update).toHaveBeenCalledWith({
      where: { id: 'org_claim_1' },
      data: expect.objectContaining({ originalSubscriptionClaimId: 'team', memberCount: 5 }),
    });
    expect(prisma.subscription.upsert).toHaveBeenCalledWith({
      where: { organisationId: 'org_1' },
      create: { organisationId: 'org_1', status: SubscriptionStatus.ACTIVE },
      update: { scheduledClaimId: null, scheduledAt: null },
    });
  });

  it('turns a personal organisation into an organisation on a team plan', async () => {
    mockOrganisation({ claimId: 'free', monthlyPriceCents: 0, type: OrganisationType.PERSONAL });
    mockTarget('team', 14990);

    await change('team');

    expect(prisma.organisation.update).toHaveBeenCalledWith({
      where: { id: 'org_1' },
      data: { type: OrganisationType.ORGANISATION },
    });
  });

  it('keeps a personal organisation personal on the individual plan', async () => {
    mockOrganisation({ claimId: 'free', monthlyPriceCents: 0, type: OrganisationType.PERSONAL });
    mockTarget('individual', 4990);

    await change('individual');

    expect(prisma.organisation.update).not.toHaveBeenCalled();
  });

  it('schedules a downgrade for the first day of next month', async () => {
    mockOrganisation({ claimId: 'team', monthlyPriceCents: 14990 });
    mockTarget('free');

    const result = await change('free');

    const firstOfNextMonth = new Date('2026-11-01T00:00:00Z');

    expect(result).toEqual({ scheduledAt: firstOfNextMonth });
    expect(prisma.organisationClaim.update).not.toHaveBeenCalled();
    expect(prisma.subscription.upsert).toHaveBeenCalledWith({
      where: { organisationId: 'org_1' },
      create: {
        organisationId: 'org_1',
        status: SubscriptionStatus.ACTIVE,
        scheduledClaimId: 'free',
        scheduledAt: firstOfNextMonth,
      },
      update: { scheduledClaimId: 'free', scheduledAt: firstOfNextMonth },
    });
  });

  it('cancels a scheduled change when the current plan is picked again', async () => {
    mockOrganisation({ claimId: 'team', monthlyPriceCents: 14990 });
    mockTarget('team', 14990);

    const result = await change('team');

    expect(result).toEqual({ scheduledAt: null });
    expect(prisma.organisationClaim.update).not.toHaveBeenCalled();
    expect(prisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { scheduledClaimId: null, scheduledAt: null } }),
    );
  });
});
