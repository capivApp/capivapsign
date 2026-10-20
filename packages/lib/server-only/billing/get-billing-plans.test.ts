import { prisma } from '@documenso/prisma';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getBillingPlans } from './get-billing-plans';

vi.mock('@documenso/prisma', () => ({
  prisma: { subscriptionClaim: { findMany: vi.fn() } },
}));

const claim = (id: string, name: string, pricing: Record<string, number | null>) => ({
  id,
  name,
  pricing,
  flags: {},
  teamCount: 1,
  memberCount: 5,
});

beforeEach(() => {
  vi.mocked(prisma.subscriptionClaim.findMany).mockResolvedValue([
    claim('team', 'Equipe', { monthlyPriceCents: 14990, createDocumentCents: 50 }),
    claim('enterprise', 'Enterprise', {}),
    claim('free', 'Gratuito', { createDocumentCents: 90 }),
    claim('individual', 'Individual', { monthlyPriceCents: 4990 }),
  ] as never);
});

describe('getBillingPlans', () => {
  it('offers the free plan and every plan with a monthly price, cheapest first', async () => {
    const plans = await getBillingPlans();

    expect(plans.map((plan) => plan.id)).toEqual(['free', 'individual', 'team']);
  });

  it('exposes the monthly price, defaulting to zero', async () => {
    const plans = await getBillingPlans();

    expect(plans.map((plan) => plan.monthlyPriceCents)).toEqual([0, 4990, 14990]);
    expect(plans[2]).toMatchObject({ name: 'Equipe', memberCount: 5, pricing: { createDocumentCents: 50 } });
  });
});
