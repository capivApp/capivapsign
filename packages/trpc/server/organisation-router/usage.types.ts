import { BillableEventType } from '@prisma/client';
import { z } from 'zod';

export const ZGetOrganisationUsageSummaryRequestSchema = z.object({
  organisationId: z.string(),
  /** Inclusive ISO date (YYYY-MM-DD). */
  from: z.string(),
  /** Inclusive ISO date (YYYY-MM-DD). */
  to: z.string(),
});

export const ZUsageCategorySchema = z.object({
  type: z.nativeEnum(BillableEventType),
  quantity: z.number(),
  amountCents: z.number(),
});

export const ZUsageDaySchema = z.object({
  /** YYYY-MM-DD (UTC). */
  date: z.string(),
  amountCents: z.number(),
  /** Amount per category for the stacked bar chart. */
  byType: z.record(z.nativeEnum(BillableEventType), z.number()),
});

export const ZGetOrganisationUsageSummaryResponseSchema = z.object({
  totalCents: z.number(),
  documentCount: z.number(),
  avgPerDocumentCents: z.number(),
  byCategory: ZUsageCategorySchema.array(),
  byDay: ZUsageDaySchema.array(),
});

export type TGetOrganisationUsageSummaryResponse = z.infer<
  typeof ZGetOrganisationUsageSummaryResponseSchema
>;
