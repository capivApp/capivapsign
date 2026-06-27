import { z } from 'zod';

import type { JobDefinition } from '../../client/_internal/job';

const CHARGE_MONTHLY_USAGE_SWEEP_JOB_DEFINITION_ID = 'internal.charge-monthly-usage-sweep';

const CHARGE_MONTHLY_USAGE_SWEEP_JOB_DEFINITION_SCHEMA = z.object({});

export type TChargeMonthlyUsageSweepJobDefinition = z.infer<
  typeof CHARGE_MONTHLY_USAGE_SWEEP_JOB_DEFINITION_SCHEMA
>;

export const CHARGE_MONTHLY_USAGE_SWEEP_JOB_DEFINITION = {
  id: CHARGE_MONTHLY_USAGE_SWEEP_JOB_DEFINITION_ID,
  name: 'Charge Monthly Usage Sweep',
  version: '1.0.0',
  trigger: {
    name: CHARGE_MONTHLY_USAGE_SWEEP_JOB_DEFINITION_ID,
    schema: CHARGE_MONTHLY_USAGE_SWEEP_JOB_DEFINITION_SCHEMA,
    // 03:00 UTC on the 1st of every month — bills the previous calendar month.
    cron: '0 3 1 * *',
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./charge-monthly-usage-sweep.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof CHARGE_MONTHLY_USAGE_SWEEP_JOB_DEFINITION_ID,
  TChargeMonthlyUsageSweepJobDefinition
>;
