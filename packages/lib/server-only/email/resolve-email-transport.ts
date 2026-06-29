import { buildTransport } from '@documenso/email/transports/build-transport';
import { prisma } from '@documenso/prisma';
import type { EmailTransport } from '@documenso/prisma/client';
import type { Transporter } from 'nodemailer';
import { logger } from '../../utils/logger';
import { decryptEmailTransportConfig } from './email-transport-config';

export type ResolvedEmailTransport = {
  row: EmailTransport;
  transporter: Transporter;
};

/**
 * Loads an EmailTransport row, decrypts its config and builds a nodemailer
 * Transporter. Returns null when the id does not resolve or the stored config
 * cannot be decrypted/built (caller should fall back to the env mailer).
 */
export const resolveEmailTransport = async (emailTransportId: string): Promise<ResolvedEmailTransport | null> => {
  const row = await prisma.emailTransport.findUnique({
    where: { id: emailTransportId },
  });

  return buildResolvedEmailTransport(row);
};

/**
 * Resolves the global default transport (the single row flagged `isDefault`),
 * used as a fallback for organisations without an explicit transport on their
 * claim. Returns null when no default is configured.
 */
export const resolveDefaultEmailTransport = async (): Promise<ResolvedEmailTransport | null> => {
  const row = await prisma.emailTransport.findFirst({
    where: { isDefault: true },
  });

  return buildResolvedEmailTransport(row);
};

const buildResolvedEmailTransport = (row: EmailTransport | null): ResolvedEmailTransport | null => {
  if (!row) {
    return null;
  }

  try {
    const config = decryptEmailTransportConfig(row.config);
    const transporter = buildTransport(config);

    return { row, transporter };
  } catch (err) {
    logger.error({
      msg: 'Failed to decrypt or build the configured email transport',
      err,
      emailTransportId: row.id,
    });

    return null;
  }
};
