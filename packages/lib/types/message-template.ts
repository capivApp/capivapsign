import type { MessageTemplateChannel, MessageTemplateEvent } from '@prisma/client';

/**
 * Client-safe metadata for the message-template editor (org + admin). Uses
 * string literals (not the Prisma enum object) so it is safe in the browser
 * bundle. Labels are in pt-BR (the product's primary locale).
 *
 * Keep in sync with the `MessageTemplateEvent` Prisma enum and the notification
 * flows that resolve a template per event.
 */
export const MESSAGE_TEMPLATE_EVENTS: { event: MessageTemplateEvent; label: string }[] = [
  { event: 'SIGNING_REQUEST', label: 'Solicitação de assinatura' },
  { event: 'SIGNING_REMINDER', label: 'Lembrete de assinatura' },
  { event: 'DOCUMENT_COMPLETED', label: 'Documento concluído' },
  { event: 'DOCUMENT_REJECTED', label: 'Documento recusado' },
  { event: 'DOCUMENT_CANCELLED', label: 'Documento cancelado' },
  { event: 'RECIPIENT_SIGNED', label: 'Destinatário assinou (proprietário)' },
  { event: 'RECIPIENT_EXPIRED', label: 'Destinatário expirado (proprietário)' },
  { event: 'OWNER_DOCUMENT_COMPLETED', label: 'Documento concluído (proprietário)' },
  { event: 'DOCUMENT_CREATED_FROM_DIRECT_TEMPLATE', label: 'Criado por modelo direto' },
];

export const MESSAGE_TEMPLATE_CHANNELS: {
  channel: MessageTemplateChannel;
  label: string;
  /** Email has a subject line; WhatsApp does not. */
  withSubject: boolean;
}[] = [
  { channel: 'EMAIL', label: 'E-mail', withSubject: true },
  { channel: 'WHATSAPP', label: 'WhatsApp', withSubject: false },
];

/** Placeholder variables available in all templates. */
export const MESSAGE_TEMPLATE_PLACEHOLDERS = '{signer.name}, {signer.email}, {document.name}, {team.name}, {link}';
