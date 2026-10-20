import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';

type RequireBillingOrganisationOptions = {
  organisationId: string;
  userId: number;
  permission: 'MANAGE_ORGANISATION' | 'MANAGE_BILLING';
};

/**
 * Guard shared by the billing routes: billing must be on and the user must hold
 * the given permission in the organisation.
 */
export const requireBillingOrganisation = async ({
  organisationId,
  userId,
  permission,
}: RequireBillingOrganisationOptions) => {
  if (!IS_BILLING_ENABLED()) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, { message: 'Billing is not enabled' });
  }

  const organisation = await prisma.organisation.findFirst({
    where: buildOrganisationWhereQuery({
      organisationId,
      userId,
      roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP[permission],
    }),
    select: { id: true },
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'You are not authorized to access this organisation',
    });
  }

  return organisation;
};
