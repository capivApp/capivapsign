import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { resyncOrganisationBilling } from '@documenso/lib/server-only/billing/resync-organisation-billing';
import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../trpc';
import {
  ZSyncOrganisationSubscriptionRequestSchema,
  ZSyncOrganisationSubscriptionResponseSchema,
} from './sync-organisation-subscription.types';

/**
 * Re-reads the organisation's open Asaas charges and recomputes its billing
 * standing. For when a webhook was missed.
 */
export const syncOrganisationSubscriptionRoute = adminProcedure
  .input(ZSyncOrganisationSubscriptionRequestSchema)
  .output(ZSyncOrganisationSubscriptionResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId } = input;

    ctx.logger.info({ input: { organisationId } });

    const organisation = await prisma.organisation.findUnique({
      where: { id: organisationId },
      select: { id: true },
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Organisation not found',
      });
    }

    await resyncOrganisationBilling({ organisationId });
  });
