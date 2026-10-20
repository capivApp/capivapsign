import { prisma } from '@documenso/prisma';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { applyScheduledPlanChange } from '../../../server-only/billing/apply-scheduled-plan-change';
import { chargeOrganisationMonthlyUsage } from '../../../server-only/billing/charge-monthly-usage';
import type { JobRunIO } from '../../client/_internal/job';
import { run } from './charge-monthly-usage-sweep.handler';

vi.mock('@documenso/prisma', () => ({
  prisma: { organisation: { findMany: vi.fn() } },
}));

vi.mock('../../../server-only/billing/apply-scheduled-plan-change', () => ({
  applyScheduledPlanChange: vi.fn(),
}));

vi.mock('../../../server-only/billing/charge-monthly-usage', () => ({
  chargeOrganisationMonthlyUsage: vi.fn(async () => ({ totalCents: 100 })),
}));

const io = {
  runTask: vi.fn(async (_key: string, task: () => Promise<unknown>) => task()),
  logger: { error: vi.fn(), info: vi.fn() },
} as unknown as JobRunIO;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.organisation.findMany).mockResolvedValue([{ id: 'org_1' }] as never);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('charge monthly usage sweep', () => {
  it('does not bill anyone while billing is switched off', async () => {
    vi.stubEnv('NEXT_PUBLIC_FEATURE_BILLING_ENABLED', '');

    await run({ payload: {}, io });

    expect(chargeOrganisationMonthlyUsage).not.toHaveBeenCalled();
  });

  it('bills every organisation for the previous month', async () => {
    vi.stubEnv('NEXT_PUBLIC_FEATURE_BILLING_ENABLED', 'true');
    vi.useFakeTimers({ now: new Date('2026-01-01T03:00:00Z') });

    await run({ payload: {}, io });

    vi.useRealTimers();

    expect(chargeOrganisationMonthlyUsage).toHaveBeenCalledWith({ organisationId: 'org_1', year: 2025, month: 12 });
  });

  it('applies scheduled plan changes after billing the month', async () => {
    vi.stubEnv('NEXT_PUBLIC_FEATURE_BILLING_ENABLED', 'true');

    await run({ payload: {}, io });

    expect(applyScheduledPlanChange).toHaveBeenCalledWith({ organisationId: 'org_1' });
    expect(vi.mocked(chargeOrganisationMonthlyUsage).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(applyScheduledPlanChange).mock.invocationCallOrder[0],
    );
  });

  it('keeps the current plan when the month could not be billed', async () => {
    vi.stubEnv('NEXT_PUBLIC_FEATURE_BILLING_ENABLED', 'true');
    vi.mocked(chargeOrganisationMonthlyUsage).mockRejectedValueOnce(new Error('Asaas unavailable'));

    await run({ payload: {}, io });

    expect(applyScheduledPlanChange).not.toHaveBeenCalled();
  });
});
