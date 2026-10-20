import { prisma } from '@documenso/prisma';
import { SubscriptionStatus, UsageInvoiceStatus } from '@prisma/client';

import { logger } from '../../utils/logger';
import type { AsaasClient } from '../asaas/asaas-client';
import { getAsaasClient } from '../asaas/get-asaas-client';
import type { AsaasPaymentStatus } from '../asaas/types';

const INVOICE_STATUS_BY_PAYMENT_STATUS: Record<AsaasPaymentStatus, UsageInvoiceStatus> = {
  PENDING: UsageInvoiceStatus.PENDING,
  AWAITING_RISK_ANALYSIS: UsageInvoiceStatus.PENDING,
  RECEIVED: UsageInvoiceStatus.PAID,
  CONFIRMED: UsageInvoiceStatus.PAID,
  RECEIVED_IN_CASH: UsageInvoiceStatus.PAID,
  DUNNING_RECEIVED: UsageInvoiceStatus.PAID,
  OVERDUE: UsageInvoiceStatus.OVERDUE,
  DUNNING_REQUESTED: UsageInvoiceStatus.OVERDUE,
  // Money taken back by the payer's bank: the month is unpaid again.
  CHARGEBACK_REQUESTED: UsageInvoiceStatus.OVERDUE,
  CHARGEBACK_DISPUTE: UsageInvoiceStatus.OVERDUE,
  AWAITING_CHARGEBACK_REVERSAL: UsageInvoiceStatus.OVERDUE,
  // Refunds are issued by us, so the bill no longer stands.
  REFUNDED: UsageInvoiceStatus.CANCELLED,
  REFUND_REQUESTED: UsageInvoiceStatus.CANCELLED,
  REFUND_IN_PROGRESS: UsageInvoiceStatus.CANCELLED,
};

export const mapAsaasPaymentStatus = (status: AsaasPaymentStatus) =>
  INVOICE_STATUS_BY_PAYMENT_STATUS[status] ?? UsageInvoiceStatus.PENDING;

export type SyncUsageInvoicePaymentOptions = {
  paymentId: string;
  /** Deleted payments can no longer be read from Asaas. */
  isDeleted: boolean;
  now?: Date;
  asaas?: AsaasClient;
};

const resolveInvoiceStatus = async ({ paymentId, isDeleted, asaas }: SyncUsageInvoicePaymentOptions) => {
  if (isDeleted) {
    return UsageInvoiceStatus.CANCELLED;
  }

  const payment = await (asaas ?? getAsaasClient()).getPayment(paymentId);

  return mapAsaasPaymentStatus(payment.status);
};

const resolvePaidAt = (status: UsageInvoiceStatus, previousPaidAt: Date | null, now: Date) =>
  status === UsageInvoiceStatus.PAID ? (previousPaidAt ?? now) : null;

/**
 * An organisation is held to the free plan limits while any of its bills is
 * overdue, and unblocked as soon as none is. Derived from all bills rather than
 * the one that changed, so events arriving out of order cannot leave it stale.
 */
export const syncOrganisationBillingStatus = async (organisationId: string) => {
  const overdueCount = await prisma.usageInvoice.count({
    where: { organisationId, status: UsageInvoiceStatus.OVERDUE },
  });

  const status = overdueCount > 0 ? SubscriptionStatus.INACTIVE : SubscriptionStatus.ACTIVE;

  await prisma.subscription.upsert({
    where: { organisationId },
    create: { organisationId, status },
    update: { status },
  });
};

/**
 * Brings a bill in line with its Asaas charge. The current state is read from
 * Asaas instead of trusting the webhook payload, so redelivered or late events
 * are harmless.
 */
export const syncUsageInvoicePayment = async (options: SyncUsageInvoicePaymentOptions) => {
  const { paymentId, now = new Date() } = options;

  const invoice = await prisma.usageInvoice.findUnique({
    where: { asaasPaymentId: paymentId },
    select: { id: true, organisationId: true, paidAt: true },
  });

  if (!invoice) {
    logger.info({ msg: 'Asaas payment is not a CapivaSign bill, ignoring', paymentId });
    return;
  }

  const status = await resolveInvoiceStatus(options);

  await prisma.usageInvoice.update({
    where: { id: invoice.id },
    data: { status, paidAt: resolvePaidAt(status, invoice.paidAt, now) },
  });

  await syncOrganisationBillingStatus(invoice.organisationId);
};
