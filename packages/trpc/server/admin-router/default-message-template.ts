import { generateDatabaseId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { MessageTemplateChannel, MessageTemplateEvent } from '@prisma/client';
import { z } from 'zod';

import { adminProcedure } from '../trpc';

const ZUpsert = z.object({
  channel: z.nativeEnum(MessageTemplateChannel),
  event: z.nativeEnum(MessageTemplateEvent),
  subject: z.string().max(500).nullish(),
  body: z.string().min(1).max(5000),
});

const ZTemplate = z.object({
  id: z.string(),
  channel: z.nativeEnum(MessageTemplateChannel),
  event: z.nativeEnum(MessageTemplateEvent),
  subject: z.string().nullable(),
  body: z.string(),
});

export const findDefaultMessageTemplatesRoute = adminProcedure
  .output(z.object({ data: ZTemplate.array() }))
  .query(async () => {
    const data = await prisma.defaultMessageTemplate.findMany({
      select: { id: true, channel: true, event: true, subject: true, body: true },
      orderBy: [{ event: 'asc' }, { channel: 'asc' }],
    });

    return { data };
  });

export const upsertDefaultMessageTemplateRoute = adminProcedure
  .input(ZUpsert)
  .output(z.object({ id: z.string() }))
  .mutation(async ({ input }) => {
    const template = await prisma.defaultMessageTemplate.upsert({
      where: { channel_event: { channel: input.channel, event: input.event } },
      create: {
        id: generateDatabaseId('message_template'),
        channel: input.channel,
        event: input.event,
        subject: input.subject ?? null,
        body: input.body,
      },
      update: { subject: input.subject ?? null, body: input.body },
      select: { id: true },
    });

    return { id: template.id };
  });

export const deleteDefaultMessageTemplateRoute = adminProcedure
  .input(z.object({ id: z.string() }))
  .output(z.void())
  .mutation(async ({ input }) => {
    await prisma.defaultMessageTemplate.deleteMany({ where: { id: input.id } });
  });
