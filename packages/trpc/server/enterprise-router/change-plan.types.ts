import { z } from 'zod';

export const ZChangePlanRequestSchema = z.object({
  organisationId: z.string().describe('The organisation changing plan'),
  claimId: z.string().describe('The plan to move to'),
});
