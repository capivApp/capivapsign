import { MessageTemplateChannel, MessageTemplateEvent } from '@prisma/client';
import { z } from 'zod';

export const ZUpsertMessageTemplateRequestSchema = z.object({
  organisationId: z.string(),
  channel: z.nativeEnum(MessageTemplateChannel),
  event: z.nativeEnum(MessageTemplateEvent),
  subject: z.string().max(500).nullish(),
  body: z.string().min(1).max(5000),
});

export const ZUpsertMessageTemplateResponseSchema = z.object({ id: z.string() });

export const ZFindMessageTemplatesRequestSchema = z.object({
  organisationId: z.string(),
});

export const ZMessageTemplateSchema = z.object({
  id: z.string(),
  channel: z.nativeEnum(MessageTemplateChannel),
  event: z.nativeEnum(MessageTemplateEvent),
  subject: z.string().nullable(),
  body: z.string(),
});

export const ZFindMessageTemplatesResponseSchema = z.object({
  data: ZMessageTemplateSchema.array(),
});

export const ZDeleteMessageTemplateRequestSchema = z.object({
  organisationId: z.string(),
  id: z.string(),
});

export const ZDeleteMessageTemplateResponseSchema = z.void();

export type TUpsertMessageTemplateRequest = z.infer<typeof ZUpsertMessageTemplateRequestSchema>;
export type TFindMessageTemplatesResponse = z.infer<typeof ZFindMessageTemplatesResponseSchema>;
