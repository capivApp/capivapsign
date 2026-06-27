import { prisma } from '@documenso/prisma';
import type { WhatsappTransport } from '@documenso/prisma/client';

import { logger } from '../../utils/logger';
import type { WhatsappAdapter } from './adapters/whatsapp-adapter';
import { buildWhatsappTransport } from './build-whatsapp-transport';
import { decryptWhatsappTransportConfig } from './whatsapp-transport-config';

export type ResolvedWhatsappTransport = {
  row: WhatsappTransport;
  adapter: WhatsappAdapter;
};

/**
 * Loads a WhatsappTransport row, decrypts its config and builds a provider
 * adapter. Returns null when the id does not resolve or the stored config cannot
 * be decrypted/built (caller should fall back to the env default transport).
 *
 * Mirrors `server-only/email/resolve-email-transport.ts`.
 */
export const resolveWhatsappTransport = async (
  whatsappTransportId: string,
): Promise<ResolvedWhatsappTransport | null> => {
  const row = await prisma.whatsappTransport.findUnique({
    where: { id: whatsappTransportId },
  });

  if (!row) {
    return null;
  }

  try {
    const config = decryptWhatsappTransportConfig(row.config);
    const adapter = buildWhatsappTransport(config);

    return { row, adapter };
  } catch (err) {
    logger.error({
      msg: 'Failed to decrypt or build the configured WhatsApp transport',
      err,
      whatsappTransportId,
    });

    return null;
  }
};
