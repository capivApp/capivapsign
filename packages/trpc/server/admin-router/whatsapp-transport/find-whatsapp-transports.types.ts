import { ZWhatsappTransportPublicConfigSchema } from '@documenso/lib/server-only/whatsapp/whatsapp-transport-config';
import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';
import WhatsappTransportSchema from '@documenso/prisma/generated/zod/modelSchema/WhatsappTransportSchema';
import { z } from 'zod';

export const ZFindWhatsappTransportsRequestSchema = ZFindSearchParamsSchema;

export const ZFindWhatsappTransportsResponseSchema = ZFindResultResponse.extend({
  data: WhatsappTransportSchema.pick({
    id: true,
    name: true,
    type: true,
    isDefault: true,
    fromName: true,
    createdAt: true,
    updatedAt: true,
  })
    .extend({
      _count: z.object({
        subscriptionClaims: z.number(),
        organisationClaims: z.number(),
      }),
      // Non-secret connection settings, so the edit form can pre-fill them.
      // Null when the stored config can't be decrypted/parsed.
      config: ZWhatsappTransportPublicConfigSchema.nullable(),
    })
    .array(),
});

export type TFindWhatsappTransportsRequest = z.infer<typeof ZFindWhatsappTransportsRequestSchema>;
export type TFindWhatsappTransportsResponse = z.infer<typeof ZFindWhatsappTransportsResponseSchema>;
