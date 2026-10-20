import { prisma } from '@documenso/prisma';
import { UsageInvoiceStatus } from '@prisma/client';

import { syncOrganisationBillingStatus, syncUsageInvoicePayment } from './sync-usage-invoice-payment';

/**
 * Admin recovery for a missed webhook: re-reads every open charge from Asaas
 * and recomputes whether the organisation is held to free plan limits.
 */
export const resyncOrganisationBilling = async ({ organisationId }: { organisationId: string }) => {
  const openInvoices = await prisma.usageInvoice.findMany({
    where: {
      organisationId,
      asaasPaymentId: { not: null },
      status: { in: [UsageInvoiceStatus.PENDING, UsageInvoiceStatus.OVERDUE] },
    },
    select: { asaasPaymentId: true },
  });

  for (const { asaasPaymentId } of openInvoices) {
    await syncUsageInvoicePayment({ paymentId: asaasPaymentId ?? '', isDeleted: false });
  }

  await syncOrganisationBillingStatus(organisationId);
};
