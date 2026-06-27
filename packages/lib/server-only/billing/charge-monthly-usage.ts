import { prisma } from '@documenso/prisma';

import { stripe } from '../stripe';
import type { TClaimPricing } from '../../types/subscription';
import { generateDatabaseId } from '../../universal/id';
import { logger } from '../../utils/logger';

export type ChargeMonthlyUsageOptions = {
  organisationId: string;
  /** Calendar month to bill, e.g. { year: 2026, month: 6 } for June. */
  year: number;
  month: number;
  /**
   * When true, only computes the breakdown and does NOT touch Stripe. Useful for
   * previews / the billing panel.
   */
  dryRun?: boolean;
};

export type MonthlyUsageBreakdown = {
  organisationId: string;
  period: string;
  currency: 'brl';
  monthlyPriceCents: number;
  meteredCents: number;
  totalCents: number;
  byCategory: { type: string; amountCents: number }[];
};

/**
 * Bills one organisation for a calendar month: the fixed monthly plan price plus
 * the metered usage recorded in `UsageEvent`. Creates Stripe invoice items and a
 * single invoice on the organisation's customer.
 *
 * Idempotency note: callers must run this once per org per month (the monthly
 * sweep job does). Re-running creates duplicate invoice items.
 */
export const chargeOrganisationMonthlyUsage = async (
  options: ChargeMonthlyUsageOptions,
): Promise<MonthlyUsageBreakdown> => {
  const { organisationId, year, month } = options;

  const periodStart = new Date(Date.UTC(year, month - 1, 1));
  const periodEnd = new Date(Date.UTC(year, month, 1));
  const period = `${year}-${String(month).padStart(2, '0')}`;

  const organisation = await prisma.organisation.findUniqueOrThrow({
    where: { id: organisationId },
    include: { organisationClaim: true, subscription: true },
  });

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const pricing = (organisation.organisationClaim.pricing ?? {}) as TClaimPricing;
  const monthlyPriceCents = pricing.monthlyPriceCents ?? 0;

  const grouped = await prisma.usageEvent.groupBy({
    by: ['type'],
    where: { organisationId, createdAt: { gte: periodStart, lt: periodEnd } },
    _sum: { amountCents: true },
  });

  const byCategory = grouped
    .map((row) => ({ type: row.type, amountCents: row._sum.amountCents ?? 0 }))
    .filter((row) => row.amountCents > 0);

  const meteredCents = byCategory.reduce((sum, row) => sum + row.amountCents, 0);
  const totalCents = monthlyPriceCents + meteredCents;

  const breakdown: MonthlyUsageBreakdown = {
    organisationId,
    period,
    currency: 'brl',
    monthlyPriceCents,
    meteredCents,
    totalCents,
    byCategory,
  };

  if (options.dryRun) {
    return breakdown;
  }

  // Idempotency: one bill per (organisation, period). If already billed, skip —
  // the unique constraint also protects against concurrent sweeps.
  const existing = await prisma.usageInvoice.findUnique({
    where: { organisationId_period: { organisationId, period } },
  });

  if (existing) {
    logger.info({ msg: 'chargeMonthlyUsage: already billed, skipping', organisationId, period });
    return breakdown;
  }

  if (totalCents <= 0) {
    return breakdown;
  }

  // Reserve the period first so a concurrent run hits the unique constraint.
  try {
    await prisma.usageInvoice.create({
      data: {
        id: generateDatabaseId('usage_invoice'),
        organisationId,
        period,
        monthlyPriceCents,
        meteredCents,
        totalCents,
      },
    });
  } catch (err) {
    logger.info({ msg: 'chargeMonthlyUsage: period already reserved, skipping', organisationId, period });
    return breakdown;
  }

  const customerId = organisation.subscription?.customerId;

  if (!customerId) {
    logger.warn({ msg: 'chargeMonthlyUsage: organisation has no Stripe customer', organisationId, period });
    return breakdown;
  }

  // One invoice item for the fixed plan price...
  if (monthlyPriceCents > 0) {
    await stripe.invoiceItems.create({
      customer: customerId,
      amount: monthlyPriceCents,
      currency: 'brl',
      description: `CapivaSign — assinatura ${period}`,
    });
  }

  // ...and one per metered category.
  for (const row of byCategory) {
    await stripe.invoiceItems.create({
      customer: customerId,
      amount: row.amountCents,
      currency: 'brl',
      description: `CapivaSign — uso ${row.type} (${period})`,
    });
  }

  // Collect the pending invoice items into a single invoice and let Stripe
  // finalise + collect automatically.
  const invoice = await stripe.invoices.create({
    customer: customerId,
    auto_advance: true,
    description: `CapivaSign — fatura ${period}`,
  });

  await prisma.usageInvoice.update({
    where: { organisationId_period: { organisationId, period } },
    data: { stripeInvoiceId: invoice.id },
  });

  logger.info({ msg: 'chargeMonthlyUsage: invoice created', organisationId, period, totalCents, stripeInvoiceId: invoice.id });

  return breakdown;
};
