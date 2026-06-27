import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { resolveWhatsappTransport } from '@documenso/lib/server-only/whatsapp/resolve-whatsapp-transport';
import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../../trpc';
import {
  ZSendTestWhatsappTransportRequestSchema,
  ZSendTestWhatsappTransportResponseSchema,
} from './send-test-whatsapp-transport.types';

export const sendTestWhatsappTransportRoute = adminProcedure
  .input(ZSendTestWhatsappTransportRequestSchema)
  .output(ZSendTestWhatsappTransportResponseSchema)
  .mutation(async ({ input, ctx }) => {
    ctx.logger.info({
      input: {
        id: input.id,
      },
    });

    const transport = await prisma.whatsappTransport.findUnique({
      where: {
        id: input.id,
      },
    });

    if (!transport) {
      throw new AppError(AppErrorCode.NOT_FOUND, { message: 'WhatsApp transport not found' });
    }

    const resolved = await resolveWhatsappTransport(input.id);

    if (!resolved) {
      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Failed to build transport from stored configuration.',
      });
    }

    try {
      await resolved.adapter.sendMessage({
        to: input.to,
        body: `Teste do transporte WhatsApp "${transport.name}" (CapivaSign).`,
      });
    } catch (err) {
      throw AppError.parseError(err);
    }
  });
