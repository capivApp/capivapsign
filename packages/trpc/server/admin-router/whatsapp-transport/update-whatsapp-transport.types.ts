import { ZZapiConfigSchema } from '@documenso/lib/server-only/whatsapp/whatsapp-transport-config';
import { z } from 'zod';

// Reuses the canonical config schemas but relaxes the secret fields so a
// blank/omitted value means "keep existing". See the email transport update
// types for the rationale (`.partial()` keeps `.min(1)`, so we override).
const ZUpdateConfigSchema = z.discriminatedUnion('type', [
  ZZapiConfigSchema.extend({ token: z.string().optional(), clientToken: z.string().optional() }),
]);

export const ZUpdateWhatsappTransportRequestSchema = z.object({
  id: z.string(),
  data: z.object({
    name: z.string().min(1),
    fromName: z.string().min(1),
    config: ZUpdateConfigSchema,
  }),
});

export const ZUpdateWhatsappTransportResponseSchema = z.void();

export type TUpdateWhatsappTransportRequest = z.infer<typeof ZUpdateWhatsappTransportRequestSchema>;
