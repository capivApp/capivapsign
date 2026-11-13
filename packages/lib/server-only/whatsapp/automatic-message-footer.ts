import type { WhatsappContextKind } from './get-whatsapp-context';

const FOOTER_BY_KIND: Record<WhatsappContextKind, string> = {
  // The CapivaSign default number: nobody reads replies sent to it.
  capiva: '_Mensagem automática, não precisa responder._',
  own: '_Mensagem automática._',
};

/** Appends the "automatic message" footer, worded by which number sends it. */
export const withAutomaticMessageFooter = (body: string, kind: WhatsappContextKind): string =>
  `${body}\n\n${FOOTER_BY_KIND[kind]}`;
