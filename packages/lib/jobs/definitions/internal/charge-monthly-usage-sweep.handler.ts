import { prisma } from '@documenso/prisma';

import { IS_BILLING_ENABLED } from '../../../constants/app';
import { applyScheduledPlanChange } from '../../../server-only/billing/apply-scheduled-plan-change';
import { chargeOrganisationMonthlyUsage } from '../../../server-only/billing/charge-monthly-usage';
import type { JobRunIO } from '../../client/_internal/job';
import type { TChargeMonthlyUsageSweepJobDefinition } from './charge-monthly-usage-sweep';

/**
 * Bills every organisation for the PREVIOUS calendar month: one Asaas charge
 * with the plan fee plus the metered usage. Idempotent per (org, month) via the
 * UsageInvoice unique constraint, so a re-run never double-charges. Does
 * nothing while billing is switched off. Scheduled downgrades take effect
 * right after the month is billed.
 */
export const run = async ({ io }: { payload: TChargeMonthlyUsageSweepJobDefinition; io: JobRunIO }) => {
  if (!IS_BILLING_ENABLED()) {
    return;
  }

  const now = new Date();
  // Previous month (UTC). January wraps to December of the prior year.
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const year = prev.getUTCFullYear();
  const month = prev.getUTCMonth() + 1;

  const organisations = await prisma.organisation.findMany({ select: { id: true } });

  for (const organisation of organisations) {
    await io.runTask(`charge-${organisation.id}-${year}-${month}`, async () => {
      try {
        const breakdown = await chargeOrganisationMonthlyUsage({
          organisationId: organisation.id,
          year,
          month,
        });

        // Only once the month is billed: a downgrade applied before a failed
        // charge would make the retry bill the cheaper plan.
        await applyScheduledPlanChange({ organisationId: organisation.id });

        return { organisationId: organisation.id, totalCents: breakdown.totalCents };
      } catch (err) {
        // Never let one org's billing failure abort the whole sweep.
        io.logger.error({
          msg: 'Monthly usage charge failed for organisation',
          organisationId: organisation.id,
          err,
        });

        return { organisationId: organisation.id, failed: true };
      }
    });
  }
};
