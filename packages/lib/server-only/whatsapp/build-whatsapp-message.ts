import { BRAND_NAME } from '../../constants/brand';

/** Events whose built-in WhatsApp copy lives here. */
export type WhatsappMessageEvent =
  | 'SIGNING_REQUEST'
  | 'SIGNING_REMINDER'
  | 'DOCUMENT_COMPLETED'
  | 'DOCUMENT_CANCELLED'
  | 'DOCUMENT_REJECTED';

export type WhatsappMessageInput = {
  /** Recipient's full name; only the first name is used in the greeting. */
  signerName: string;
  /** Who sent the document (the envelope owner). */
  senderName: string;
  documentName: string;
  link?: string;
  /** Lower-case verb for the recipient role, e.g. "assinar" or "aprovar". */
  actionVerb?: string;
};

/**
 * Built-in WhatsApp copy for each notification event: the message sent when
 * neither the organisation nor the admin set a template for that event.
 * WhatsApp renders `*text*` as bold. No em dashes in user-facing text.
 */
export const buildWhatsappMessage = (event: WhatsappMessageEvent, input: WhatsappMessageInput): string =>
  [buildHeader(event), '', buildGreeting(input.signerName), '', ...BODY_BY_EVENT[event](input)].join('\n');

/** The document owner's name, or the team name when the owner has none. */
export const resolveSenderName = (ownerName: string | null | undefined, teamName: string): string =>
  ownerName?.trim() || teamName;

const HEADER_BY_EVENT: Record<WhatsappMessageEvent, (brand: string) => string> = {
  SIGNING_REQUEST: (brand) => `✍️ *${brand}*`,
  SIGNING_REMINDER: (brand) => `⏰ *${brand}* · Lembrete`,
  DOCUMENT_COMPLETED: (brand) => `✅ *${brand}*`,
  DOCUMENT_CANCELLED: (brand) => `🚫 *${brand}*`,
  DOCUMENT_REJECTED: (brand) => `📝 *${brand}*`,
};

const BODY_BY_EVENT: Record<WhatsappMessageEvent, (input: WhatsappMessageInput) => string[]> = {
  SIGNING_REQUEST: ({ senderName, documentName, link, actionVerb }) => [
    `*${senderName}* enviou o documento *${documentName}* para você ${actionVerb}.`,
    '',
    `Acesse para ${actionVerb}:`,
    link ?? '',
  ],
  SIGNING_REMINDER: ({ senderName, documentName, link, actionVerb }) => [
    `O documento *${documentName}*, enviado por *${senderName}*, ainda está esperando por você.`,
    '',
    `Acesse para ${actionVerb}:`,
    link ?? '',
  ],
  DOCUMENT_COMPLETED: ({ senderName, documentName, link }) => [
    `O documento *${documentName}*, enviado por *${senderName}*, foi assinado por todos e está concluído.`,
    '',
    'Baixe a versão final:',
    link ?? '',
  ],
  DOCUMENT_CANCELLED: ({ senderName, documentName }) => [
    `*${senderName}* cancelou o documento *${documentName}*. Você não precisa fazer mais nada.`,
  ],
  DOCUMENT_REJECTED: ({ senderName, documentName }) => [
    `Registramos que você recusou o documento *${documentName}*, enviado por *${senderName}*. Avisamos *${senderName}*.`,
  ],
};

const buildHeader = (event: WhatsappMessageEvent): string => HEADER_BY_EVENT[event](BRAND_NAME());

const buildGreeting = (signerName: string): string => {
  const firstName = signerName.trim().split(/\s+/)[0];

  if (!firstName) {
    return 'Olá!';
  }

  return `Olá, ${firstName}!`;
};
