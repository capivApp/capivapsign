import { z } from 'zod';

export const ZGetBillingRequestSchema = z.object({
  organisationId: z.string().describe('The organisation to get the billing overview for'),
});
