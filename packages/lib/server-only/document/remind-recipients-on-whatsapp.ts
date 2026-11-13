import { RecipientRole } from '@prisma/client';

import { sendWhatsappNotification } from '../whatsapp/send-whatsapp-notification';

export type WhatsappReminderRecipient = {
  name: string;
  email: string;
  phone: string | null;
  role: RecipientRole;
  token: string;
};

export type RemindRecipientsOnWhatsappOptions = {
  teamId: number;
  documentTitle: string;
  recipients: WhatsappReminderRecipient[];
  buildSigningLink: (token: string) => string;
  /** Translated, lower-case action verb for the recipient role (e.g. "assinar"). */
  getActionVerb: (role: RecipientRole) => string;
};

const isReachableOnWhatsapp = (recipient: WhatsappReminderRecipient): boolean =>
  Boolean(recipient.phone) && recipient.role !== RecipientRole.CC;

/**
 * WhatsApp side of a manual resend: same event and fallback copy as the automatic
 * signing reminder, so the org template for SIGNING_REMINDER applies to both.
 * Best-effort per recipient (sendWhatsappNotification never throws).
 */
export const remindRecipientsOnWhatsapp = async ({
  teamId,
  documentTitle,
  recipients,
  buildSigningLink,
  getActionVerb,
}: RemindRecipientsOnWhatsappOptions): Promise<void> => {
  await Promise.all(
    recipients.filter(isReachableOnWhatsapp).map(async (recipient) => {
      const link = buildSigningLink(recipient.token);
      const actionVerb = getActionVerb(recipient.role);

      await sendWhatsappNotification({
        teamId,
        event: 'SIGNING_REMINDER',
        to: recipient.phone,
        vars: {
          'signer.name': recipient.name,
          'signer.email': recipient.email,
          'document.name': documentTitle,
          link,
        },
        fallbackBody: `Lembrete: ${actionVerb} o documento "${documentTitle}". Acesse: ${link}`,
      });
    }),
  );
};
