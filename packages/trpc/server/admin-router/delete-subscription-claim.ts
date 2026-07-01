import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../trpc';
import {
  ZDeleteSubscriptionClaimRequestSchema,
  ZDeleteSubscriptionClaimResponseSchema,
} from './delete-subscription-claim.types';

export const deleteSubscriptionClaimRoute = adminProcedure
  .input(ZDeleteSubscriptionClaimRequestSchema)
  .output(ZDeleteSubscriptionClaimResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { id } = input;

    ctx.logger.info({
      input: {
        id,
      },
    });

    const existingClaim = await prisma.subscriptionClaim.findFirst({
      where: {
        id,
      },
    });

    if (!existingClaim) {
      throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Subscription claim not found' });
    }

    // Locked claims are the built-in plans (Free, Individual, …). They are safe
    // to delete — organisations keep their own OrganisationClaim copy and there
    // is no FK back to SubscriptionClaim — so the `locked` flag is only a UI
    // warning, not a hard block, letting admins remove plans they don't offer.
    await prisma.subscriptionClaim.delete({
      where: {
        id,
      },
    });
  });
