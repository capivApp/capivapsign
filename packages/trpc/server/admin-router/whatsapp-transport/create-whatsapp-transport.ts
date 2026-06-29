import { generateDatabaseId } from '@documenso/lib/universal/id';
import { encryptWhatsappTransportConfig } from '@documenso/lib/server-only/whatsapp/whatsapp-transport-config';
import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../../trpc';
import {
  ZCreateWhatsappTransportRequestSchema,
  ZCreateWhatsappTransportResponseSchema,
} from './create-whatsapp-transport.types';

export const createWhatsappTransportRoute = adminProcedure
  .input(ZCreateWhatsappTransportRequestSchema)
  .output(ZCreateWhatsappTransportResponseSchema)
  .mutation(async ({ input }) => {
    const { name, fromName, isDefault = false, config } = input;

    const transport = await prisma.$transaction(async (tx) => {
      // Only one transport may be the global default, so clear the flag on every
      // other row before promoting this one.
      if (isDefault) {
        await tx.whatsappTransport.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
      }

      return tx.whatsappTransport.create({
        data: {
          id: generateDatabaseId('whatsapp_transport'),
          name,
          type: config.type,
          fromName,
          isDefault,
          config: encryptWhatsappTransportConfig(config),
        },
        select: { id: true },
      });
    });

    return {
      id: transport.id,
    };
  });
