import { Hono } from 'hono';

import { extractRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';

import { completeIcpRecipientSigning } from '../complete-recipient-signing';
import { ZIcpCompleteRequestSchema, ZIcpPrepareRequestSchema } from '../desktop-protocol';
import { prepareIcpRecipientSigning } from '../prepare-recipient-signing';
import type { HonoIcpEnv } from './context';
import { attachDesktopSessionIfPresent } from './device-auth';

/**
 * `/api/icp/sign/*` — the desktop-driven signing endpoints.
 *
 *   POST /prepare   capture per-item digests for a recipient + chosen cert
 *   POST /complete  embed the desktop-produced signatures (B-T), schedule seal
 *
 * Authorised by capability: `prepare` by the recipient token, `complete` by the
 * (unguessable, single-use) session id — same trust as the signing link. A
 * paired desktop may additionally present a device token, which is attached when
 * valid. Errors throw `AppError` and are normalised by the parent `.onError`.
 */
export const icpSignRoutes = new Hono<HonoIcpEnv>()
  .use('*', attachDesktopSessionIfPresent)
  .post('/prepare', async (c) => {
    const body = ZIcpPrepareRequestSchema.parse(await c.req.json());
    const requestMetadata = extractRequestMetadata(c.req.raw);

    const result = await prepareIcpRecipientSigning({
      recipientToken: body.recipientToken,
      certChainB64: body.certChainB64,
      certType: body.certType,
      requestMetadata,
    });

    return c.json(result);
  })
  .post('/complete', async (c) => {
    const body = ZIcpCompleteRequestSchema.parse(await c.req.json());
    const requestMetadata = extractRequestMetadata(c.req.raw);

    const result = await completeIcpRecipientSigning({
      sessionId: body.sessionId,
      items: body.items,
      requestMetadata,
    });

    return c.json(result);
  });
