import { prisma } from '@documenso/prisma';
import { OrganisationType, SubscriptionStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppErrorCode } from '../../errors/app-error';
import { grantOrganisationPlan } from './grant-organisation-plan';

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

const ENTERPRISE_CLAIM = {
  id: 'enterprise',
  name: 'Enterprise',
  locked: true,
  teamCount: 0,
  memberCount: 0,
  envelopeItemCount: 20,
  recipientCount: 0,
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.subscriptionClaim.findUnique).mockResolvedValue(ENTERPRISE_CLAIM as never);
  vi.mocked(prisma.organisation.findUniqueOrThrow).mockResolvedValue({
    id: 'org_1',
    type: OrganisationType.PERSONAL,
    customerId: null,
    organisationClaim: { id: 'org_claim_1', originalSubscriptionClaimId: 'free', pricing: {} },
  } as never);
});

describe('grantOrganisationPlan', () => {
  it('refuses plans that do not exist', async () => {
    vi.mocked(prisma.subscriptionClaim.findUnique).mockResolvedValue(null);

    await expect(
      grantOrganisationPlan({ organisationId: 'org_1', claimId: 'missing', discountPercent: 100 }),
    ).rejects.toMatchObject({ code: AppErrorCode.NOT_FOUND });
  });

  it('applies any plan right away, without billing details, and stores the discount', async () => {
    await grantOrganisationPlan({ organisationId: 'org_1', claimId: 'enterprise', discountPercent: 100 });

    expect(prisma.organisationClaim.update).toHaveBeenCalledWith({
      where: { id: 'org_claim_1' },
      data: expect.objectContaining({ originalSubscriptionClaimId: 'enterprise' }),
    });
    expect(prisma.organisation.update).toHaveBeenCalledWith({
      where: { id: 'org_1' },
      data: { type: OrganisationType.ORGANISATION },
    });
    expect(prisma.subscription.upsert).toHaveBeenLastCalledWith({
      where: { organisationId: 'org_1' },
      create: { organisationId: 'org_1', status: SubscriptionStatus.ACTIVE, discountPercent: 100 },
      update: { discountPercent: 100 },
    });
  });

  it('rejects discounts outside 0 to 100', async () => {
    await expect(
      grantOrganisationPlan({ organisationId: 'org_1', claimId: 'enterprise', discountPercent: 101 }),
    ).rejects.toMatchObject({ code: AppErrorCode.INVALID_BODY });
  });
});
