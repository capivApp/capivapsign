import {
  BillableEventType,
  DocumentStatus,
  EnvelopeType,
  MessageTemplateChannel,
  MessageTemplateEvent,
  RecipientRole,
  SendStatus,
} from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { recordUsage } from '../../../server-only/billing/record-usage';
import { resolveMessageTemplate } from '../../../server-only/messaging/resolve-message-template';
import { renderCustomEmailTemplate } from '../../../utils/render-custom-email-template';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../../constants/app';
import { RECIPIENT_ROLES_DESCRIPTION } from '../../../constants/recipient-roles';
import { getI18nInstance } from '../../../client-only/providers/i18n-server';
import { getWhatsappContext } from '../../../server-only/whatsapp/get-whatsapp-context';
import { extractDerivedDocumentEmailSettings } from '../../../types/document-email';
import { unsafeBuildEnvelopeIdQuery } from '../../../utils/envelope';
import { updateRecipientNextReminder } from '../../../server-only/recipient/update-recipient-next-reminder';
import { msg } from '@lingui/core/macro';
import type { JobRunIO } from '../../client/_internal/job';
import type { TSendSigningWhatsappJobDefinition } from './send-signing-whatsapp';

/**
 * Sends the "please sign" notification over WhatsApp instead of email, for
 * recipients whose `deliveryChannel` is WHATSAPP. Mirrors the structure of
 * `send-signing-email.handler.ts` but routes through the per-org WhatsApp
 * transport (with CapivaApp env fallback). Message templating is inline here;
 * org-managed templates arrive in a later phase.
 */
export const run = async ({
  payload,
  io,
}: {
  payload: TSendSigningWhatsappJobDefinition;
  io: JobRunIO;
}) => {
  const { documentId, recipientId, source } = payload;

  const [envelope, recipient] = await Promise.all([
    prisma.envelope.findFirstOrThrow({
      where: {
        ...unsafeBuildEnvelopeIdQuery({ type: 'documentId', id: documentId }, EnvelopeType.DOCUMENT),
        status: DocumentStatus.PENDING,
      },
      include: {
        documentMeta: true,
        user: { select: { disabled: true } },
        team: { select: { id: true, name: true } },
      },
    }),
    prisma.recipient.findFirstOrThrow({ where: { id: recipientId } }),
  ]);

  if (recipient.role === RecipientRole.CC) {
    return;
  }

  const signingRequestEnabled = extractDerivedDocumentEmailSettings(
    envelope.documentMeta,
  ).recipientSigningRequest;

  if (!signingRequestEnabled || envelope.user.disabled) {
    return;
  }

  if (!recipient.phone) {
    io.logger.warn({
      msg: 'WhatsApp signing request dropped: recipient has no phone',
      recipientId: recipient.id,
      envelopeId: envelope.id,
    });

    return;
  }

  const whatsapp = await getWhatsappContext({ type: 'team', teamId: envelope.teamId });

  if (!whatsapp.enabled) {
    io.logger.warn({
      msg: 'WhatsApp signing request dropped: no WhatsApp transport configured',
      organisationId: whatsapp.organisationId,
      envelopeId: envelope.id,
    });

    return;
  }

  const i18n = await getI18nInstance(envelope.documentMeta?.language ?? undefined);
  const actionVerb = i18n._(RECIPIENT_ROLES_DESCRIPTION[recipient.role].actionVerb).toLowerCase();
  const signLink = `${NEXT_PUBLIC_WEBAPP_URL()}/sign/${recipient.token}`;

  // Org-managed WhatsApp template (if any), else the built-in default message.
  const template = await resolveMessageTemplate({
    organisationId: whatsapp.organisationId,
    channel: MessageTemplateChannel.WHATSAPP,
    event: MessageTemplateEvent.SIGNING_REQUEST,
  });

  const body = template
    ? renderCustomEmailTemplate(template.body, {
        'signer.name': recipient.name,
        'signer.email': recipient.email,
        'document.name': envelope.title,
        'team.name': envelope.team.name,
        link: signLink,
      })
    : i18n._(
        msg`${whatsapp.fromName}: ${envelope.team.name} convidou você a ${actionVerb} o documento "${envelope.title}". Acesse: ${signLink}`,
      );

  await io.runTask('send-signing-whatsapp', async () => {
    const result = await whatsapp.adapter.sendMessage({ to: recipient.phone!, body });

    io.logger.info({
      msg: 'WhatsApp signing request sent',
      recipientId: recipient.id,
      envelopeId: envelope.id,
      providerMessageId: result.providerMessageId,
    });

    // Bill the message only when the send originated from the API. Price depends
    // on which transport sent it (own vs CapivaSign default).
    await recordUsage({
      type: BillableEventType.WHATSAPP_MESSAGE,
      source: source ?? 'app',
      organisationId: whatsapp.organisationId,
      teamId: envelope.teamId,
      whatsappTransport: whatsapp.kind,
      metadata: { envelopeId: envelope.id, recipientId: recipient.id, transport: whatsapp.kind },
    });
  });

  const sentAt = new Date();

  await io.runTask('update-recipient', async () => {
    await prisma.recipient.update({
      where: { id: recipient.id },
      data: { sendStatus: SendStatus.SENT, sentAt },
    });
  });

  await updateRecipientNextReminder({
    recipientId: recipient.id,
    envelopeId: envelope.id,
    sentAt,
    lastReminderSentAt: null,
  });
};
