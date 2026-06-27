import { BillableEventType, type MessageTemplateEvent } from '@prisma/client';

import { recordUsage } from '../billing/record-usage';
import { resolveMessageTemplate } from '../messaging/resolve-message-template';
import { renderCustomEmailTemplate } from '../../utils/render-custom-email-template';
import { logger } from '../../utils/logger';
import { getWhatsappContext } from './get-whatsapp-context';

export type WhatsappNotificationVars = {
  'signer.name'?: string;
  'signer.email'?: string;
  'document.name'?: string;
  'team.name'?: string;
  link?: string;
};

/**
 * Sends one WhatsApp notification for a given template event, resolving the
 * template (org → admin default → built-in fallback), rendering placeholders,
 * sending via the org's transport (own or CapivaSign default) and billing it.
 *
 * Best-effort: never throws — a notification failure must not break the flow
 * that triggered it. No-op when the recipient has no phone or no transport is
 * configured.
 *
 * `fallbackBody` is the built-in copy used when neither the org nor the admin
 * has set a template for this (event, WHATSAPP).
 */
export const sendWhatsappNotification = async (options: {
  teamId: number;
  event: MessageTemplateEvent;
  to: string | null | undefined;
  vars: WhatsappNotificationVars;
  fallbackBody: string;
  source?: 'apiV1' | 'apiV2' | 'app';
}): Promise<void> => {
  try {
    if (!options.to) {
      return;
    }

    const whatsapp = await getWhatsappContext({ type: 'team', teamId: options.teamId });

    if (!whatsapp.enabled) {
      return;
    }

    const template = await resolveMessageTemplate({
      organisationId: whatsapp.organisationId,
      channel: 'WHATSAPP',
      event: options.event,
    });

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const vars = options.vars as Record<string, string>;
    const body = renderCustomEmailTemplate(template?.body ?? options.fallbackBody, vars);

    await whatsapp.adapter.sendMessage({ to: options.to, body });

    await recordUsage({
      type: BillableEventType.WHATSAPP_MESSAGE,
      source: options.source ?? 'app',
      organisationId: whatsapp.organisationId,
      teamId: options.teamId,
      whatsappTransport: whatsapp.kind,
      metadata: { event: options.event },
    });
  } catch (err) {
    logger.error({ msg: 'sendWhatsappNotification failed', err, event: options.event });
  }
};
