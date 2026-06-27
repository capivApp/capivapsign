import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';
import { BillableEventType, Prisma } from '@prisma/client';

import { authenticatedProcedure } from '../trpc';
import {
  ZGetOrganisationUsageSummaryRequestSchema,
  ZGetOrganisationUsageSummaryResponseSchema,
} from './usage.types';

type DayRow = { day: Date; type: BillableEventType; amount: bigint; qty: bigint };

export const getOrganisationUsageSummaryRoute = authenticatedProcedure
  .input(ZGetOrganisationUsageSummaryRequestSchema)
  .output(ZGetOrganisationUsageSummaryResponseSchema)
  .query(async ({ input, ctx }) => {
    const { organisationId, from, to } = input;

    const organisation = await prisma.organisation.findFirst({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId: ctx.user.id,
        roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      }),
      select: { id: true },
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.UNAUTHORIZED);
    }

    // Inclusive day range in UTC.
    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDate = new Date(`${to}T23:59:59.999Z`);

    const where: Prisma.UsageEventWhereInput = {
      organisationId,
      createdAt: { gte: fromDate, lte: toDate },
    };

    const [byCategoryRaw, dayRows] = await Promise.all([
      prisma.usageEvent.groupBy({
        by: ['type'],
        where,
        _sum: { amountCents: true, quantity: true },
      }),
      prisma.$queryRaw<DayRow[]>`
        SELECT date_trunc('day', "createdAt") AS day,
               "type"                          AS type,
               SUM("amountCents")              AS amount,
               SUM("quantity")                 AS qty
        FROM "UsageEvent"
        WHERE "organisationId" = ${organisationId}
          AND "createdAt" >= ${fromDate}
          AND "createdAt" <= ${toDate}
        GROUP BY day, "type"
        ORDER BY day ASC
      `,
    ]);

    const byCategory = byCategoryRaw.map((row) => ({
      type: row.type,
      quantity: row._sum.quantity ?? 0,
      amountCents: row._sum.amountCents ?? 0,
    }));

    const totalCents = byCategory.reduce((sum, row) => sum + row.amountCents, 0);
    const documentCount =
      byCategory.find((row) => row.type === BillableEventType.CREATE_DOCUMENT)?.quantity ?? 0;
    const avgPerDocumentCents = documentCount > 0 ? Math.round(totalCents / documentCount) : 0;

    // Shape the per-day, per-type rows into one record per day for the chart.
    const dayMap = new Map<string, { date: string; amountCents: number; byType: Record<string, number> }>();

    for (const row of dayRows) {
      const date = row.day.toISOString().slice(0, 10);
      const amount = Number(row.amount);

      const entry = dayMap.get(date) ?? { date, amountCents: 0, byType: {} };
      entry.amountCents += amount;
      entry.byType[row.type] = (entry.byType[row.type] ?? 0) + amount;
      dayMap.set(date, entry);
    }

    return {
      totalCents,
      documentCount,
      avgPerDocumentCents,
      byCategory,
      byDay: Array.from(dayMap.values()),
    };
  });
