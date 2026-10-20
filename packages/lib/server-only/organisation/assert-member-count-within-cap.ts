import type { OrganisationClaim } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';

/**
 * Refuses adding members (members plus pending invites) beyond the plan's cap.
 * A `memberCount` of 0 means unlimited. Only grow paths call this; removing
 * members is never gated.
 */
export const assertMemberCountWithinCap = (
  organisationClaim: Pick<OrganisationClaim, 'memberCount'>,
  quantity: number,
) => {
  const maximumMemberCount = organisationClaim.memberCount;

  if (maximumMemberCount === 0 || quantity <= maximumMemberCount) {
    return;
  }

  throw new AppError(AppErrorCode.LIMIT_EXCEEDED, {
    message: 'Maximum member count reached',
  });
};
