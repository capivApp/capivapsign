import { chargeOrganisationMonthlyUsage } from '@documenso/lib/server-only/billing/charge-monthly-usage';
import { z } from 'zod';

import { adminProcedure } from '../trpc';

export const ZChargeOrganisationMonthRequestSchema = z.object({
  organisationId: z.string(),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  /** Preview only: computes the itemised bill without saving it or calling Asaas. */
  dryRun: z.boolean().default(false),
});

export const ZChargeOrganisationMonthResponseSchema = z.object({
  organisationId: z.string(),
  period: z.string(),
  monthlyPriceCents: z.number(),
  meteredCents: z.number(),
  totalCents: z.number(),
  items: z.array(
    z.object({
      description: z.string(),
      quantity: z.number(),
      unitPriceCents: z.number(),
      amountCents: z.number(),
    }),
  ),
});

/**
 * Admin action to bill one organisation for a given month (plan fee + metered
 * usage) as one Asaas charge. Idempotent per (org, month); re-running it retries
 * a saved bill whose charge failed. Useful for re-issuing a missed month.
 */
export const chargeOrganisationMonthRoute = adminProcedure
  .input(ZChargeOrganisationMonthRequestSchema)
  .output(ZChargeOrganisationMonthResponseSchema)
  .mutation(async ({ input, ctx }) => {
    ctx.logger.info({
      msg: 'Admin charging organisation month',
      organisationId: input.organisationId,
      period: `${input.year}-${input.month}`,
      dryRun: input.dryRun,
    });

    const breakdown = await chargeOrganisationMonthlyUsage({
      organisationId: input.organisationId,
      year: input.year,
      month: input.month,
      dryRun: input.dryRun,
    });

    return {
      organisationId: breakdown.organisationId,
      period: breakdown.period,
      monthlyPriceCents: breakdown.monthlyPriceCents,
      meteredCents: breakdown.meteredCents,
      totalCents: breakdown.totalCents,
      items: breakdown.items,
    };
  });
