import { mailer } from '@documenso/email/mailer';
import type { Transporter } from 'nodemailer';

import { DOCUMENSO_INTERNAL_EMAIL } from '../../constants/email';
import { resolveDefaultEmailTransport } from './resolve-email-transport';

export type AuthEmailTransport = {
  transporter: Transporter;
  senderEmail: {
    name: string;
    address: string;
  };
};

/**
 * Resolves the transport used for account-level auth emails (signup
 * confirmation, forgot/reset password).
 *
 * These are sent before any organisation context exists, so `getEmailContext`
 * does not apply. Instead we honour the global default transport configured in
 * the admin panel (`EmailTransport.isDefault`) and only fall back to the system
 * `mailer` + CapivaSign sender when no default is configured or it fails to
 * resolve — otherwise the admin's configured provider would be ignored and the
 * mail silently never delivered.
 */
export const getAuthEmailTransport = async (): Promise<AuthEmailTransport> => {
  const transportResolution = await resolveDefaultEmailTransport();

  if (!transportResolution) {
    return {
      transporter: mailer,
      senderEmail: DOCUMENSO_INTERNAL_EMAIL,
    };
  }

  return {
    transporter: transportResolution.transporter,
    senderEmail: {
      name: transportResolution.row.fromName,
      address: transportResolution.row.fromAddress,
    },
  };
};
