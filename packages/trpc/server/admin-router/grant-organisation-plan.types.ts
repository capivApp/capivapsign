import { z } from 'zod';

export const ZGrantOrganisationPlanRequestSchema = z.object({
  organisationId: z.string(),
  claimId: z.string().min(1, 'Escolha um plano.'),
  discountPercent: z.number().int().min(0, 'Use de 0 a 100.').max(100, 'Use de 0 a 100.'),
});

export const ZGrantOrganisationPlanResponseSchema = z.void();
