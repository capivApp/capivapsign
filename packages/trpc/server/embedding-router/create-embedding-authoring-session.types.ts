import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc';
import { ZCreateEnvelopeRequestSchema } from '../envelope-router/create-envelope.types';

export const createEmbeddingAuthoringSessionMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/embedding/authoring-session',
    summary: 'Create an embedded authoring (signature positioner) session',
    description:
      'Creates a draft envelope (with the recipients sent in this request) and returns a no-login link to the signature positioner, scoped to that envelope. Open the returned `embedUrl` in a new tab/portal in your own app to position the signature fields and send the document.',
    tags: ['Embedding'],
  },
};

// Same multipart payload as creating an envelope (title, type, recipients, files).
export const ZCreateEmbeddingAuthoringSessionRequestSchema = ZCreateEnvelopeRequestSchema;

export const ZCreateEmbeddingAuthoringSessionResponseSchema = z.object({
  envelopeId: z.string(),
  /** No-login link to the positioner, scoped to this envelope. Open in a tab/portal. */
  embedUrl: z.string(),
  /** The scoped presign token embedded in `embedUrl` (also returned for convenience). */
  token: z.string(),
  expiresAt: z.date(),
});

export type TCreateEmbeddingAuthoringSessionResponse = z.infer<
  typeof ZCreateEmbeddingAuthoringSessionResponseSchema
>;
