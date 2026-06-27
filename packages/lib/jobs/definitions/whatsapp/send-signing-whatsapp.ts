import { z } from 'zod';

import { ZRequestMetadataSchema } from '../../../universal/extract-request-metadata';
import type { JobDefinition } from '../../client/_internal/job';

const SEND_SIGNING_WHATSAPP_JOB_DEFINITION_ID = 'send.signing.requested.whatsapp';

const SEND_SIGNING_WHATSAPP_JOB_DEFINITION_SCHEMA = z.object({
  userId: z.number(),
  documentId: z.number(),
  recipientId: z.number(),
  requestMetadata: ZRequestMetadataSchema.optional(),
  // Originating request source — used to bill WhatsApp messages only for
  // API-originated sends (panel sends are free).
  source: z.enum(['apiV1', 'apiV2', 'app']).optional(),
});

export type TSendSigningWhatsappJobDefinition = z.infer<typeof SEND_SIGNING_WHATSAPP_JOB_DEFINITION_SCHEMA>;

export const SEND_SIGNING_WHATSAPP_JOB_DEFINITION = {
  id: SEND_SIGNING_WHATSAPP_JOB_DEFINITION_ID,
  name: 'Send Signing WhatsApp',
  version: '1.0.0',
  trigger: {
    name: SEND_SIGNING_WHATSAPP_JOB_DEFINITION_ID,
    schema: SEND_SIGNING_WHATSAPP_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./send-signing-whatsapp.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof SEND_SIGNING_WHATSAPP_JOB_DEFINITION_ID,
  TSendSigningWhatsappJobDefinition
>;
