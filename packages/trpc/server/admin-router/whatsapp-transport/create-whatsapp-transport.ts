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
    const { name, fromName, config } = input;

    const transport = await prisma.whatsappTransport.create({
      data: {
        id: generateDatabaseId('whatsapp_transport'),
        name,
        type: config.type,
        fromName,
        config: encryptWhatsappTransportConfig(config),
      },
      select: { id: true },
    });

    return {
      id: transport.id,
    };
  });
