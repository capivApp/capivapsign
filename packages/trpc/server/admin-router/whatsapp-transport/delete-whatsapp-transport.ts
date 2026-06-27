import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../../trpc';
import {
  ZDeleteWhatsappTransportRequestSchema,
  ZDeleteWhatsappTransportResponseSchema,
} from './delete-whatsapp-transport.types';

export const deleteWhatsappTransportRoute = adminProcedure
  .input(ZDeleteWhatsappTransportRequestSchema)
  .output(ZDeleteWhatsappTransportResponseSchema)
  .mutation(async ({ input, ctx }) => {
    ctx.logger.info({
      input: {
        id: input.id,
      },
    });

    await prisma.whatsappTransport.delete({
      where: {
        id: input.id,
      },
    });
  });
