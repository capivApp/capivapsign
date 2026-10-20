import { changeOrganisationPlan } from '@documenso/lib/server-only/billing/change-organisation-plan';

import { authenticatedProcedure } from '../trpc';
import { ZChangePlanRequestSchema } from './change-plan.types';
import { requireBillingOrganisation } from './require-billing-organisation';

export const changePlanRoute = authenticatedProcedure
  .input(ZChangePlanRequestSchema)
  .mutation(async ({ ctx, input }) => {
    const { organisationId, claimId } = input;

    ctx.logger.info({ input: { organisationId, claimId } });

    await requireBillingOrganisation({ organisationId, userId: ctx.user.id, permission: 'MANAGE_BILLING' });

    return await changeOrganisationPlan({ organisationId, claimId });
  });
