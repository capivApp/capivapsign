import { z } from 'zod';

export const ZDeleteWhatsappTransportRequestSchema = z.object({
  id: z.string(),
});

export const ZDeleteWhatsappTransportResponseSchema = z.void();
