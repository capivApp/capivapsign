import { saveOrganisationBillingProfile } from '@documenso/lib/server-only/billing/save-organisation-billing-profile';

import { authenticatedProcedure } from '../trpc';
import { requireBillingOrganisation } from './require-billing-organisation';
import { ZUpdateBillingProfileRequestSchema } from './update-billing-profile.types';

export const updateBillingProfileRoute = authenticatedProcedure
  .input(ZUpdateBillingProfileRequestSchema)
  .mutation(async ({ ctx, input }) => {
    const { organisationId, billingName, billingDocument, billingEmail } = input;

    ctx.logger.info({ input: { organisationId } });

    await requireBillingOrganisation({ organisationId, userId: ctx.user.id, permission: 'MANAGE_BILLING' });

    await saveOrganisationBillingProfile({ organisationId, billingName, billingDocument, billingEmail });
  });
