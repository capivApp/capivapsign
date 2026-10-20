import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { createOrganisation } from '@documenso/lib/server-only/organisation/create-organisation';
import { getSubscriptionClaim } from '@documenso/lib/server-only/subscription/get-subscription-claim';
import { INTERNAL_CLAIM_ID } from '@documenso/lib/types/subscription';
import { prisma } from '@documenso/prisma';
import { OrganisationType } from '@prisma/client';

import { authenticatedProcedure } from '../trpc';
import { ZCreateOrganisationRequestSchema, ZCreateOrganisationResponseSchema } from './create-organisation.types';

/**
 * With billing on, a user owns at most one organisation on the free plan; a
 * paid plan is picked afterwards on the organisation's billing page.
 */
const assertCanCreateFreeOrganisation = async (userId: number) => {
  const freeOrganisationCount = await prisma.organisation.count({
    where: {
      ownerUserId: userId,
      organisationClaim: { originalSubscriptionClaimId: INTERNAL_CLAIM_ID.FREE },
    },
  });

  if (freeOrganisationCount > 0) {
    throw new AppError(AppErrorCode.LIMIT_EXCEEDED, {
      message: 'You have reached the maximum number of free organisations.',
      userMessage:
        'Você já tem uma organização no plano gratuito. Escolha um plano pago para ela antes de criar outra.',
    });
  }
};

export const createOrganisationRoute = authenticatedProcedure
  .input(ZCreateOrganisationRequestSchema)
  .output(ZCreateOrganisationResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { name } = input;
    const { user } = ctx;

    ctx.logger.info({ input: { name } });

    if (IS_BILLING_ENABLED()) {
      await assertCanCreateFreeOrganisation(user.id);
    }

    // Free organisations are personal by default when billing is on.
    const organisationType = IS_BILLING_ENABLED() ? OrganisationType.PERSONAL : OrganisationType.ORGANISATION;

    await createOrganisation({
      userId: user.id,
      name,
      type: organisationType,
      claim: await getSubscriptionClaim(INTERNAL_CLAIM_ID.FREE),
    });
  });
