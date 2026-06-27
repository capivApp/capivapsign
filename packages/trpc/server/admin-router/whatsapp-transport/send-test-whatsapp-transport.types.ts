import { z } from 'zod';

export const ZSendTestWhatsappTransportRequestSchema = z.object({
  id: z.string(),
  // Destination phone (digits with country code, e.g. "5511999999999").
  to: z.string().min(8),
});

export const ZSendTestWhatsappTransportResponseSchema = z.void();

export type TSendTestWhatsappTransportResponse = z.infer<
  typeof ZSendTestWhatsappTransportResponseSchema
>;
