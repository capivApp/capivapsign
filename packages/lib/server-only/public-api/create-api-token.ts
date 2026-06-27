import { prisma } from '@documenso/prisma';
import type { Duration } from 'luxon';
import { DateTime } from 'luxon';

import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '../../constants/teams';
// temporary choice for testing only
import * as timeConstants from '../../constants/time';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { alphaid } from '../../universal/id';
import { buildTeamWhereQuery } from '../../utils/teams';
import { hashString } from '../auth/hash';

type TimeConstants = typeof timeConstants & {
  [key: string]: number | Duration;
};

type CreateApiTokenInput = {
  userId: number;
  teamId: number;
  tokenName: string;
  expiresIn: string | null;
  /**
   * Assign the token to a specific member instead of the creator (org-level
   * "key for a specific user"). Must belong to the team's organisation.
   */
  targetUserId?: number;
};

export const createApiToken = async ({
  userId,
  teamId,
  tokenName,
  expiresIn,
  targetUserId,
}: CreateApiTokenInput) => {
  const apiToken = `api_${alphaid(16)}`;

  const hashedToken = hashString(apiToken);

  const timeConstantsRecords: TimeConstants = timeConstants;

  const team = await prisma.team.findFirst({
    where: buildTeamWhereQuery({
      teamId,
      userId,
      roles: TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM'],
    }),
  });

  if (!team) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'You do not have permission to create a token for this team',
    });
  }

  // When targeting another member, ensure they belong to the team's organisation.
  if (targetUserId && targetUserId !== userId) {
    const member = await prisma.organisationMember.findFirst({
      where: { organisationId: team.organisationId, userId: targetUserId },
      select: { id: true },
    });

    if (!member) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'The target user is not a member of this organisation',
      });
    }
  }

  const storedToken = await prisma.apiToken.create({
    data: {
      name: tokenName,
      token: hashedToken,
      expires: expiresIn ? DateTime.now().plus(timeConstantsRecords[expiresIn]).toJSDate() : null,
      userId: targetUserId ?? userId,
      teamId,
      organisationId: team.organisationId,
    },
  });

  return {
    id: storedToken.id,
    token: apiToken,
  };
};
