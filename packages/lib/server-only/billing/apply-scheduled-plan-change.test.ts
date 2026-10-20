import { prisma } from '@documenso/prisma';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { applyScheduledPlanChange } from './apply-scheduled-plan-change';

vi.mock('@documenso/prisma', () => {
  const client = {
    subscription: { findUnique: vi.fn(), update: vi.fn() },
    subscriptionClaim: { findUnique: vi.fn() },
    organisation: { findUniqueOrThrow: vi.fn() },
    organisationClaim: { update: vi.fn() },
    $transaction: vi.fn(),
  };

  client.$transaction.mockImplementation(async (callback: (tx: typeof client) => Promise<unknown>) => callback(client));

  return { prisma: client };
});

const NOW = new Date('2026-11-01T03:00:00Z');

const FREE_CLAIM = {
  id: 'free',
  name: 'Gratuito',
  locked: true,
  teamCount: 1,
  memberCount: 1,
  envelopeItemCount: 5,
  recipientCount: 10,
  flags: {},
  pricing: {},
  documentRateLimits: [],
  documentQuota: null,
  emailRateLimits: [],
  emailQuota: null,
  apiRateLimits: [],
  apiQuota: null,
  emailTransportId: null,
  whatsappTransportId: null,
};

const mockSchedule = (scheduledAt: Date | null, scheduledClaimId: string | null = 'free') => {
  vi.mocked(prisma.subscription.findUnique).mockResolvedValue({ scheduledClaimId, scheduledAt } as never);
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.subscriptionClaim.findUnique).mockResolvedValue(FREE_CLAIM as never);
  vi.mocked(prisma.organisation.findUniqueOrThrow).mockResolvedValue({ organisationClaimId: 'org_claim_1' } as never);
});

describe('applyScheduledPlanChange', () => {
  it('does nothing without a scheduled change', async () => {
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);

    await applyScheduledPlanChange({ organisationId: 'org_1', now: NOW });

    expect(prisma.organisationClaim.update).not.toHaveBeenCalled();
  });

  it('waits until the scheduled date', async () => {
    mockSchedule(new Date('2026-12-01T00:00:00Z'));

    await applyScheduledPlanChange({ organisationId: 'org_1', now: NOW });

    expect(prisma.organisationClaim.update).not.toHaveBeenCalled();
  });

  it('applies the scheduled plan once due and clears the schedule', async () => {
    mockSchedule(new Date('2026-11-01T00:00:00Z'));

    await applyScheduledPlanChange({ organisationId: 'org_1', now: NOW });

    expect(prisma.organisationClaim.update).toHaveBeenCalledWith({
      where: { id: 'org_claim_1' },
      data: expect.objectContaining({ originalSubscriptionClaimId: 'free', memberCount: 1 }),
    });
    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { organisationId: 'org_1' },
      data: { scheduledClaimId: null, scheduledAt: null },
    });
  });
});
