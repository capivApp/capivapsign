import { ZWhatsappTransportConfigSchema } from '@documenso/lib/server-only/whatsapp/whatsapp-transport-config';
import { z } from 'zod';

export const ZCreateWhatsappTransportRequestSchema = z.object({
  name: z.string().min(1),
  fromName: z.string().min(1),
  config: ZWhatsappTransportConfigSchema,
});

export const ZCreateWhatsappTransportResponseSchema = z.object({
  id: z.string(),
});

export type TCreateWhatsappTransportRequest = z.infer<typeof ZCreateWhatsappTransportRequestSchema>;
