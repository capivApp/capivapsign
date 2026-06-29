import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import {
  decryptWhatsappTransportConfig,
  encryptWhatsappTransportConfig,
  WHATSAPP_TRANSPORT_SECRET_KEYS,
  ZWhatsappTransportConfigSchema,
} from '@documenso/lib/server-only/whatsapp/whatsapp-transport-config';
import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../../trpc';
import {
  ZUpdateWhatsappTransportRequestSchema,
  ZUpdateWhatsappTransportResponseSchema,
} from './update-whatsapp-transport.types';

export const updateWhatsappTransportRoute = adminProcedure
  .input(ZUpdateWhatsappTransportRequestSchema)
  .output(ZUpdateWhatsappTransportResponseSchema)
  .mutation(async ({ input }) => {
    const { id, data } = input;

    const existing = await prisma.whatsappTransport.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError(AppErrorCode.NOT_FOUND, { message: 'WhatsApp transport not found' });
    }

    const existingConfig = decryptWhatsappTransportConfig(existing.config);

    // Start from the incoming config; backfill empty secret fields from the
    // existing config (only when the type is unchanged).
    const merged: Record<string, unknown> = { ...data.config };

    if (existingConfig.type === data.config.type) {
      for (const key of WHATSAPP_TRANSPORT_SECRET_KEYS) {
        const incoming = (data.config as Record<string, unknown>)[key];
        if (incoming === undefined || incoming === '') {
          merged[key] = (existingConfig as Record<string, unknown>)[key];
        }
      }
    }

    const config = ZWhatsappTransportConfigSchema.parse(merged);
    const isDefault = data.isDefault ?? existing.isDefault;

    await prisma.$transaction(async (tx) => {
      // Only one transport may be the global default, so clear it elsewhere
      // before promoting this row.
      if (isDefault) {
        await tx.whatsappTransport.updateMany({
          where: { isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }

      await tx.whatsappTransport.update({
        where: { id },
        data: {
          name: data.name,
          type: config.type,
          fromName: data.fromName,
          isDefault,
          config: encryptWhatsappTransportConfig(config),
        },
      });
    });
  });
