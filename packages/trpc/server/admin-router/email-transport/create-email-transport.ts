import { encryptEmailTransportConfig } from '@documenso/lib/server-only/email/email-transport-config';
import { generateDatabaseId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../../trpc';
import {
  ZCreateEmailTransportRequestSchema,
  ZCreateEmailTransportResponseSchema,
} from './create-email-transport.types';

export const createEmailTransportRoute = adminProcedure
  .input(ZCreateEmailTransportRequestSchema)
  .output(ZCreateEmailTransportResponseSchema)
  .mutation(async ({ input }) => {
    const { name, fromName, fromAddress, isDefault = false, config } = input;

    const transport = await prisma.$transaction(async (tx) => {
      // Only one transport may be the global default, so clear the flag on every
      // other row before promoting this one.
      if (isDefault) {
        await tx.emailTransport.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
      }

      return tx.emailTransport.create({
        data: {
          id: generateDatabaseId('email_transport'),
          name,
          type: config.type,
          fromName,
          fromAddress,
          isDefault,
          config: encryptEmailTransportConfig(config),
        },
        select: { id: true },
      });
    });

    return {
      id: transport.id,
    };
  });
