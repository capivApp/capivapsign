import { IS_BILLING_ENABLED, NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { recordUsage } from '@documenso/lib/server-only/billing/record-usage';
import { createEmbeddingPresignToken } from '@documenso/lib/server-only/embedding-presign/create-embedding-presign-token';
import { getOrganisationClaimByTeamId } from '@documenso/lib/server-only/organisation/get-organisation-claims';
import { getApiTokenByToken } from '@documenso/lib/server-only/public-api/get-api-token-by-token';
import { BillableEventType } from '@prisma/client';

import { createEnvelopeRouteCaller } from '../envelope-router/create-envelope';
import { procedure } from '../trpc';
import {
  createEmbeddingAuthoringSessionMeta,
  ZCreateEmbeddingAuthoringSessionRequestSchema,
  ZCreateEmbeddingAuthoringSessionResponseSchema,
} from './create-embedding-authoring-session.types';

// How long the positioner link stays valid (minutes). 24h is comfortable for a
// human positioning session without leaving the link valid indefinitely.
const SESSION_EXPIRES_IN_MINUTES = 1440;

/**
 * One-shot endpoint for embedding the signature positioner in another system:
 * authenticates with the customer's API key, creates a DRAFT envelope with the
 * recipients from this request, then returns a no-login `embedUrl` to the
 * positioner scoped to that envelope. The customer opens the URL in a new tab /
 * portal — no iframe / frame-ancestors config required.
 */
export const createEmbeddingAuthoringSessionRoute = procedure
  .meta(createEmbeddingAuthoringSessionMeta)
  .input(ZCreateEmbeddingAuthoringSessionRequestSchema)
  .output(ZCreateEmbeddingAuthoringSessionResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const authorizationHeader = ctx.req.headers.get('authorization');
    const [apiToken] = (authorizationHeader || '').split('Bearer ').filter((s) => s.length > 0);

    if (!apiToken) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, { message: 'No API token provided' });
    }

    const token = await getApiTokenByToken({ token: apiToken });

    if (!token.userId) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, { message: 'Invalid API token' });
    }

    if (IS_BILLING_ENABLED()) {
      const organisationClaim = await getOrganisationClaimByTeamId({ teamId: token.teamId });

      if (!organisationClaim.flags.embedAuthoring) {
        throw new AppError(AppErrorCode.UNAUTHORIZED, {
          message: 'Embedded Authoring is not included in your current plan. Please contact support.',
        });
      }
    }

    // 1) Create the draft envelope (with the request's recipients) as the API user.
    const { id: envelopeId } = await createEnvelopeRouteCaller({
      userId: token.userId,
      teamId: token.teamId,
      input,
      options: {
        // Recipients are added explicitly here; don't auto-add the editor as one.
        bypassDefaultRecipients: true,
      },
      apiRequestMetadata: ctx.metadata,
      logger: ctx.logger,
    });

    // Bill the embed session (API-only billable action).
    await recordUsage({
      type: BillableEventType.EMBED_SESSION,
      source: ctx.metadata.source,
      teamId: token.teamId,
      userId: token.userId,
      apiTokenId: token.id,
      metadata: { envelopeId },
    });

    // 2) Presign token scoped to THIS envelope → the link only grants positioner
    // access to this envelope, and expires.
    const presign = await createEmbeddingPresignToken({
      apiToken,
      expiresIn: SESSION_EXPIRES_IN_MINUTES,
      scope: `envelopeId:${envelopeId}`,
    });

    const embedUrl =
      `${NEXT_PUBLIC_WEBAPP_URL()}/embed/v2/authoring/envelope/edit/${envelopeId}` +
      `?token=${encodeURIComponent(presign.token)}`;

    return {
      envelopeId,
      embedUrl,
      token: presign.token,
      expiresAt: presign.expiresAt,
    };
  });
