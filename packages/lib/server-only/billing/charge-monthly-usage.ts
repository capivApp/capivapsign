import { prisma } from '@documenso/prisma';
import { UsageInvoiceStatus } from '@prisma/client';

import type { TClaimPricing } from '../../types/subscription';
import { generateDatabaseId } from '../../universal/id';
import { logger } from '../../utils/logger';
import type { AsaasClient } from '../asaas/asaas-client';
import { getAsaasClient } from '../asaas/get-asaas-client';
import {
  applyInvoiceDiscount,
  buildInvoiceDescription,
  buildMonthlyInvoiceItems,
  getInvoiceDueDate,
  type MonthlyInvoiceItem,
} from './build-monthly-invoice';
import { renderBillingStatementPdf } from './render-billing-statement-pdf';

export type ChargeMonthlyUsageOptions = {
  organisationId: string;
  /** Calendar month to bill, e.g. { year: 2026, month: 6 } for June. */
  year: number;
  month: number;
  /** Only computes the itemised bill; nothing is saved or sent to Asaas. */
  dryRun?: boolean;
  /** Issue date, defaults to now. The due date is counted from it. */
  now?: Date;
  asaas?: AsaasClient;
};

export type MonthlyUsageBreakdown = {
  organisationId: string;
  period: string;
  currency: 'brl';
  monthlyPriceCents: number;
  meteredCents: number;
  /** Admin-granted discount taken off the plan fee plus usage. */
  discountCents: number;
  totalCents: number;
  items: MonthlyInvoiceItem[];
};

type BillableOrganisation = Awaited<ReturnType<typeof findBillableOrganisation>>;

type IssueChargeOptions = {
  organisation: BillableOrganisation;
  breakdown: MonthlyUsageBreakdown;
  usageInvoiceId: string;
  now: Date;
  asaas: AsaasClient;
};

const findBillableOrganisation = async (organisationId: string) =>
  prisma.organisation.findUniqueOrThrow({
    where: { id: organisationId },
    select: {
      id: true,
      name: true,
      customerId: true,
      billingName: true,
      billingDocument: true,
      billingEmail: true,
      organisationClaim: { select: { originalSubscriptionClaimId: true, pricing: true } },
      subscription: { select: { discountPercent: true } },
    },
  });

const findPlanName = async (subscriptionClaimId: string | null) => {
  const claim = subscriptionClaimId
    ? await prisma.subscriptionClaim.findUnique({ where: { id: subscriptionClaimId }, select: { name: true } })
    : null;

  return claim?.name ?? '';
};

// Events already carry their price net of the free allowance, so the billed
// amount per (category, unit price) is all a line needs.
const findMonthlyUsage = async (organisationId: string, periodStart: Date, periodEnd: Date) => {
  const grouped = await prisma.usageEvent.groupBy({
    by: ['type', 'unitPriceCents'],
    where: { organisationId, amountCents: { gt: 0 }, createdAt: { gte: periodStart, lt: periodEnd } },
    _sum: { amountCents: true },
  });

  return grouped.map((row) => ({
    type: row.type,
    unitPriceCents: row.unitPriceCents,
    amountCents: row._sum.amountCents ?? 0,
  }));
};

const buildBreakdown = async (organisation: BillableOrganisation, year: number, month: number) => {
  const periodStart = new Date(Date.UTC(year, month - 1, 1));
  const periodEnd = new Date(Date.UTC(year, month, 1));

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const pricing = (organisation.organisationClaim.pricing ?? {}) as TClaimPricing;
  const monthlyPriceCents = pricing.monthlyPriceCents ?? 0;

  const [planName, usage] = await Promise.all([
    findPlanName(organisation.organisationClaim.originalSubscriptionClaimId),
    findMonthlyUsage(organisation.id, periodStart, periodEnd),
  ]);

  const billedItems = buildMonthlyInvoiceItems({ planName, monthlyPriceCents, usage });
  const subtotalCents = billedItems.reduce((sum, item) => sum + item.amountCents, 0);

  const items = applyInvoiceDiscount(billedItems, organisation.subscription?.discountPercent ?? 0);
  const totalCents = items.reduce((sum, item) => sum + item.amountCents, 0);

  return {
    organisationId: organisation.id,
    period: `${year}-${String(month).padStart(2, '0')}`,
    currency: 'brl',
    monthlyPriceCents,
    meteredCents: subtotalCents - monthlyPriceCents,
    discountCents: subtotalCents - totalCents,
    totalCents,
    items,
  } satisfies MonthlyUsageBreakdown;
};

/**
 * Saves the bill with its lines. The (organisation, period) unique constraint
 * makes a concurrent run fail here instead of billing twice.
 */
const createUsageInvoice = async (breakdown: MonthlyUsageBreakdown) =>
  prisma.usageInvoice.create({
    data: {
      id: generateDatabaseId('usage_invoice'),
      organisationId: breakdown.organisationId,
      period: breakdown.period,
      monthlyPriceCents: breakdown.monthlyPriceCents,
      meteredCents: breakdown.meteredCents,
      totalCents: breakdown.totalCents,
      // Fully discounted bills are kept so the organisation sees the amounts,
      // but there is nothing to collect.
      status: breakdown.totalCents > 0 ? UsageInvoiceStatus.PENDING : UsageInvoiceStatus.WAIVED,
      items: {
        create: breakdown.items.map((item, position) => ({
          id: generateDatabaseId('usage_invoice_item'),
          position,
          ...item,
        })),
      },
    },
  });

const attachStatement = async ({
  organisation,
  breakdown,
  now,
  asaas,
  paymentId,
  invoiceUrl,
  dueDate,
}: IssueChargeOptions & { paymentId: string; invoiceUrl: string; dueDate: string }) => {
  try {
    const file = await renderBillingStatementPdf({
      period: breakdown.period,
      issuedAt: now,
      dueDate,
      organisationName: organisation.name,
      payer: {
        name: organisation.billingName ?? organisation.name,
        document: organisation.billingDocument ?? '',
        email: organisation.billingEmail ?? '',
      },
      invoiceUrl,
      items: breakdown.items,
    });

    await asaas.uploadPaymentDocument(paymentId, {
      file,
      fileName: `demonstrativo-${breakdown.period}.pdf`,
      type: 'INVOICE',
      availableAfterPayment: false,
    });
  } catch (err) {
    // The charge is valid without the attachment: its description already
    // itemises the bill, and the app lists every line.
    logger.error({ msg: 'chargeMonthlyUsage: statement upload failed', organisationId: organisation.id, err });
  }
};

const issueAsaasCharge = async (options: IssueChargeOptions) => {
  const { organisation, breakdown, usageInvoiceId, now, asaas } = options;

  if (!organisation.customerId) {
    logger.warn({ msg: 'chargeMonthlyUsage: organisation has no Asaas customer', organisationId: organisation.id });
    return;
  }

  const dueDate = getInvoiceDueDate(now);

  const payment = await asaas.createPayment({
    customer: organisation.customerId,
    billingType: 'UNDEFINED',
    value: breakdown.totalCents / 100,
    dueDate,
    description: buildInvoiceDescription({ period: breakdown.period, items: breakdown.items }),
    externalReference: usageInvoiceId,
  });

  await prisma.usageInvoice.update({
    where: { id: usageInvoiceId },
    data: { asaasPaymentId: payment.id, invoiceUrl: payment.invoiceUrl, dueDate: new Date(dueDate) },
  });

  await attachStatement({ ...options, paymentId: payment.id, invoiceUrl: payment.invoiceUrl, dueDate });

  logger.info({
    msg: 'chargeMonthlyUsage: Asaas charge created',
    organisationId: organisation.id,
    period: breakdown.period,
    totalCents: breakdown.totalCents,
    asaasPaymentId: payment.id,
  });
};

/**
 * Bills one organisation for a calendar month: ONE Asaas charge (Pix, boleto or
 * card) with the plan fee plus the metered usage, itemised in the description
 * and in an attached statement. Safe to re-run: a month already charged is
 * skipped, and a saved bill whose charge failed is charged again.
 */
export const chargeOrganisationMonthlyUsage = async ({
  organisationId,
  year,
  month,
  dryRun,
  now = new Date(),
  asaas,
}: ChargeMonthlyUsageOptions): Promise<MonthlyUsageBreakdown> => {
  const organisation = await findBillableOrganisation(organisationId);
  const breakdown = await buildBreakdown(organisation, year, month);

  if (dryRun || breakdown.items.length === 0) {
    return breakdown;
  }

  const existing = await prisma.usageInvoice.findUnique({
    where: { organisationId_period: { organisationId, period: breakdown.period } },
  });

  if (existing?.asaasPaymentId) {
    logger.info({ msg: 'chargeMonthlyUsage: already charged, skipping', organisationId, period: breakdown.period });
    return breakdown;
  }

  const usageInvoice = existing ?? (await createUsageInvoice(breakdown));

  if (breakdown.totalCents <= 0) {
    return breakdown;
  }

  await issueAsaasCharge({
    organisation,
    breakdown,
    usageInvoiceId: usageInvoice.id,
    now,
    asaas: asaas ?? getAsaasClient(),
  });

  return breakdown;
};
