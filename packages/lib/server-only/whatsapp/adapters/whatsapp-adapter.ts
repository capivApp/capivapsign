/**
 * WhatsApp sending strategy.
 *
 * Each provider (Z-API today) implements this interface; the factory
 * (`build-whatsapp-transport.ts`) picks one by `config.type`. Mirrors how
 * `packages/email/transports/build-transport.ts` returns a nodemailer
 * Transporter — here we return a thin adapter that sends one text message.
 */
export type WhatsappSendInput = {
  /** Destination phone, digits with country code (e.g. "5511999999999"). */
  to: string;
  /** Already-rendered message body. */
  body: string;
};

export type WhatsappSendResult = {
  /** Provider-side message id, when the provider returns one. */
  providerMessageId?: string;
};

export interface WhatsappAdapter {
  sendMessage(input: WhatsappSendInput): Promise<WhatsappSendResult>;
}
