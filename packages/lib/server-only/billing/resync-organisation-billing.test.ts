import { prisma } from '@documenso/prisma';
import { UsageInvoiceStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resyncOrganisationBilling } from './resync-organisation-billing';
import { syncOrganisationBillingStatus, syncUsageInvoicePayment } from './sync-usage-invoice-payment';

vi.mock('@documenso/prisma', () => ({
  prisma: { usageInvoice: { findMany: vi.fn() } },
}));

vi.mock('./sync-usage-invoice-payment', () => ({
  syncUsageInvoicePayment: vi.fn(),
  syncOrganisationBillingStatus: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resyncOrganisationBilling', () => {
  it('re-reads every open charge from Asaas, then recomputes the standing', async () => {
    vi.mocked(prisma.usageInvoice.findMany).mockResolvedValue([
      { asaasPaymentId: 'pay_1' },
      { asaasPaymentId: 'pay_2' },
    ] as never);

    await resyncOrganisationBilling({ organisationId: 'org_1' });

    expect(prisma.usageInvoice.findMany).toHaveBeenCalledWith({
      where: {
        organisationId: 'org_1',
        asaasPaymentId: { not: null },
        status: { in: [UsageInvoiceStatus.PENDING, UsageInvoiceStatus.OVERDUE] },
      },
      select: { asaasPaymentId: true },
    });
    expect(syncUsageInvoicePayment).toHaveBeenCalledWith({ paymentId: 'pay_1', isDeleted: false });
    expect(syncUsageInvoicePayment).toHaveBeenCalledWith({ paymentId: 'pay_2', isDeleted: false });
    expect(syncOrganisationBillingStatus).toHaveBeenCalledWith('org_1');
  });
});
