import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import { ZGetInvoicesRequestSchema } from './get-invoices.types';
import { requireBillingOrganisation } from './require-billing-organisation';

export const getInvoicesRoute = authenticatedProcedure
  .input(ZGetInvoicesRequestSchema)
  .query(async ({ ctx, input }) => {
    const { organisationId } = input;

    ctx.logger.info({ input: { organisationId } });

    await requireBillingOrganisation({ organisationId, userId: ctx.user.id, permission: 'MANAGE_ORGANISATION' });

    return await prisma.usageInvoice.findMany({
      where: { organisationId },
      orderBy: { period: 'desc' },
      select: {
        id: true,
        period: true,
        status: true,
        totalCents: true,
        dueDate: true,
        paidAt: true,
        invoiceUrl: true,
        items: {
          orderBy: { position: 'asc' },
          select: { id: true, description: true, quantity: true, unitPriceCents: true, amountCents: true },
        },
      },
    });
  });
