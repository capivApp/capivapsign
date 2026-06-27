import { z } from 'zod';

export const ZFindOrganisationApiTokensRequestSchema = z.object({
  organisationId: z.string(),
});

export const ZOrganisationApiTokenSchema = z.object({
  id: z.number(),
  name: z.string(),
  createdAt: z.date(),
  expires: z.date().nullable(),
  teamId: z.number(),
  teamName: z.string(),
  userId: z.number().nullable(),
  userName: z.string().nullable(),
  userEmail: z.string().nullable(),
});

export const ZFindOrganisationApiTokensResponseSchema = z.object({
  data: ZOrganisationApiTokenSchema.array(),
});

export const ZCreateOrganisationApiTokenRequestSchema = z.object({
  organisationId: z.string(),
  teamId: z.number(),
  tokenName: z.string().min(3, { message: 'The token name should be 3 characters or longer' }),
  expirationDate: z.string().nullable(),
  /** Assign to a specific member; omit for an org-level key owned by the org owner. */
  targetUserId: z.number().nullish(),
});

export const ZCreateOrganisationApiTokenResponseSchema = z.object({
  id: z.number(),
  token: z.string(),
});

export const ZDeleteOrganisationApiTokenRequestSchema = z.object({
  organisationId: z.string(),
  id: z.number(),
});

export const ZDeleteOrganisationApiTokenResponseSchema = z.void();

export type TFindOrganisationApiTokensResponse = z.infer<typeof ZFindOrganisationApiTokensResponseSchema>;
