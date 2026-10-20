import { grantOrganisationPlan } from '@documenso/lib/server-only/billing/grant-organisation-plan';

import { adminProcedure } from '../trpc';
import {
  ZGrantOrganisationPlanRequestSchema,
  ZGrantOrganisationPlanResponseSchema,
} from './grant-organisation-plan.types';

/**
 * Puts an organisation on a plan right away with a standing discount, e.g. a
 * plan given away for free (100%).
 */
export const grantOrganisationPlanRoute = adminProcedure
  .input(ZGrantOrganisationPlanRequestSchema)
  .output(ZGrantOrganisationPlanResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId, claimId, discountPercent } = input;

    ctx.logger.info({ input: { organisationId, claimId, discountPercent } });

    await grantOrganisationPlan({ organisationId, claimId, discountPercent });
  });
