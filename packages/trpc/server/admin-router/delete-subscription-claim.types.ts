import { z } from 'zod';

export const ZDeleteSubscriptionClaimRequestSchema = z.object({
  // Not `.cuid()`: the built-in default claims are seeded with fixed ids
  // ("free", "individual", "team", …) that are not cuids, so they must be
  // deletable too. Matches the update route, which also accepts any string id.
  id: z.string().min(1),
});

export const ZDeleteSubscriptionClaimResponseSchema = z.void();

export type TDeleteSubscriptionClaimRequest = z.infer<typeof ZDeleteSubscriptionClaimRequestSchema>;
