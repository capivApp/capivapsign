import type { MessageTemplateChannel, MessageTemplateEvent } from '@prisma/client';

import { prisma } from '@documenso/prisma';

export type ResolvedMessageTemplate = {
  subject: string | null;
  body: string;
};

/**
 * Resolves an organisation-managed message template for a (channel, event) pair,
 * or null when none is set (caller falls back to the built-in CapivaApp default).
 *
 * Best-effort: any failure resolves to null. Placeholders are rendered by the
 * caller via `renderCustomEmailTemplate` (the existing `{key}` engine).
 */
export const resolveMessageTemplate = async (options: {
  organisationId: string;
  channel: MessageTemplateChannel;
  event: MessageTemplateEvent;
}): Promise<ResolvedMessageTemplate | null> => {
  const row = await prisma.messageTemplate
    .findUnique({
      where: {
        organisationId_channel_event: {
          organisationId: options.organisationId,
          channel: options.channel,
          event: options.event,
        },
      },
    })
    .catch(() => null);

  if (!row) {
    return null;
  }

  return { subject: row.subject, body: row.body };
};
