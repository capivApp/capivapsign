import { ZWhatsappTransportConfigSchema } from '@documenso/lib/server-only/whatsapp/whatsapp-transport-config';
import { z } from 'zod';

export const ZCreateWhatsappTransportRequestSchema = z.object({
  name: z.string().min(1),
  fromName: z.string().min(1),
  // When true, this becomes the global fallback transport for every organisation
  // without an explicit transport on its claim (any previous default is cleared).
  isDefault: z.boolean().optional(),
  config: ZWhatsappTransportConfigSchema,
});

export const ZCreateWhatsappTransportResponseSchema = z.object({
  id: z.string(),
});

export type TCreateWhatsappTransportRequest = z.infer<typeof ZCreateWhatsappTransportRequestSchema>;
