import {
  decryptWhatsappTransportConfig,
  toPublicWhatsappTransportConfig,
} from '@documenso/lib/server-only/whatsapp/whatsapp-transport-config';
import { prisma } from '@documenso/prisma';
import { Prisma } from '@prisma/client';

import { adminProcedure } from '../../trpc';
import {
  ZFindWhatsappTransportsRequestSchema,
  ZFindWhatsappTransportsResponseSchema,
} from './find-whatsapp-transports.types';

export const findWhatsappTransportsRoute = adminProcedure
  .input(ZFindWhatsappTransportsRequestSchema)
  .output(ZFindWhatsappTransportsResponseSchema)
  .query(async ({ input }) => {
    const { query, page = 1, perPage = 20 } = input;

    const where: Prisma.WhatsappTransportWhereInput = query
      ? {
          OR: [
            { name: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { fromName: { contains: query, mode: Prisma.QueryMode.insensitive } },
          ],
        }
      : {};

    const [transports, count] = await Promise.all([
      prisma.whatsappTransport.findMany({
        where,
        skip: (page - 1) * perPage,
        take: perPage,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { subscriptionClaims: true, organisationClaims: true },
          },
        },
      }),
      prisma.whatsappTransport.count({ where }),
    ]);

    // Replace the encrypted `config` blob with the non-secret connection
    // settings so the encrypted value (and secrets) never leave the server.
    const data = transports.map(({ config, ...transport }) => {
      let publicConfig: ReturnType<typeof toPublicWhatsappTransportConfig> | null = null;

      try {
        publicConfig = toPublicWhatsappTransportConfig(decryptWhatsappTransportConfig(config));
      } catch {
        publicConfig = null;
      }

      return {
        ...transport,
        config: publicConfig,
      };
    });

    return {
      data,
      count,
      currentPage: page,
      perPage,
      totalPages: Math.ceil(count / perPage),
    };
  });
