import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import * as timeConstants from '@documenso/lib/constants/time';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { hashString } from '@documenso/lib/server-only/auth/hash';
import { alphaid } from '@documenso/lib/universal/id';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';
import type { Duration } from 'luxon';
import { DateTime } from 'luxon';

import { authenticatedProcedure } from '../trpc';
import {
  ZCreateOrganisationApiTokenRequestSchema,
  ZCreateOrganisationApiTokenResponseSchema,
  ZDeleteOrganisationApiTokenRequestSchema,
  ZDeleteOrganisationApiTokenResponseSchema,
  ZFindOrganisationApiTokensRequestSchema,
  ZFindOrganisationApiTokensResponseSchema,
} from './api-token.types';

type TimeConstants = typeof timeConstants & { [key: string]: number | Duration };

/** Throws UNAUTHORIZED unless the user can manage the organisation. */
const assertCanManageOrganisation = async (organisationId: string, userId: number) => {
  const organisation = await prisma.organisation.findFirst({
    where: buildOrganisationWhereQuery({
      organisationId,
      userId,
      roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
    }),
    select: { id: true, ownerUserId: true },
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.UNAUTHORIZED);
  }

  return organisation;
};

export const findOrganisationApiTokensRoute = authenticatedProcedure
  .input(ZFindOrganisationApiTokensRequestSchema)
  .output(ZFindOrganisationApiTokensResponseSchema)
  .query(async ({ input, ctx }) => {
    await assertCanManageOrganisation(input.organisationId, ctx.user.id);

    const tokens = await prisma.apiToken.findMany({
      where: { organisationId: input.organisationId },
      select: {
        id: true,
        name: true,
        createdAt: true,
        expires: true,
        teamId: true,
        team: { select: { name: true } },
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: tokens.map((token) => ({
        id: token.id,
        name: token.name,
        createdAt: token.createdAt,
        expires: token.expires,
        teamId: token.teamId,
        teamName: token.team.name,
        userId: token.user?.id ?? null,
        userName: token.user?.name ?? null,
        userEmail: token.user?.email ?? null,
      })),
    };
  });

export const createOrganisationApiTokenRoute = authenticatedProcedure
  .input(ZCreateOrganisationApiTokenRequestSchema)
  .output(ZCreateOrganisationApiTokenResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId, teamId, tokenName, expirationDate, targetUserId } = input;

    const organisation = await assertCanManageOrganisation(organisationId, ctx.user.id);

    // The team must belong to the organisation.
    const team = await prisma.team.findFirst({
      where: { id: teamId, organisationId },
      select: { id: true },
    });

    if (!team) {
      throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Team not found in this organisation' });
    }

    // The target member (if any) must belong to the organisation.
    if (targetUserId) {
      const member = await prisma.organisationMember.findFirst({
        where: { organisationId, userId: targetUserId },
        select: { id: true },
      });

      if (!member) {
        throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Target user is not a member of this organisation' });
      }
    }

    const apiToken = `api_${alphaid(16)}`;
    const timeConstantsRecords: TimeConstants = timeConstants;

    const stored = await prisma.apiToken.create({
      data: {
        name: tokenName,
        token: hashString(apiToken),
        expires: expirationDate ? DateTime.now().plus(timeConstantsRecords[expirationDate]).toJSDate() : null,
        // Owner of an org-level key defaults to the org owner.
        userId: targetUserId ?? organisation.ownerUserId,
        teamId,
        organisationId,
      },
      select: { id: true },
    });

    return { id: stored.id, token: apiToken };
  });

export const deleteOrganisationApiTokenRoute = authenticatedProcedure
  .input(ZDeleteOrganisationApiTokenRequestSchema)
  .output(ZDeleteOrganisationApiTokenResponseSchema)
  .mutation(async ({ input, ctx }) => {
    await assertCanManageOrganisation(input.organisationId, ctx.user.id);

    await prisma.apiToken.deleteMany({
      where: { id: input.id, organisationId: input.organisationId },
    });
  });
