import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { generateDatabaseId } from '@documenso/lib/universal/id';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZDeleteMessageTemplateRequestSchema,
  ZDeleteMessageTemplateResponseSchema,
  ZFindMessageTemplatesRequestSchema,
  ZFindMessageTemplatesResponseSchema,
  ZUpsertMessageTemplateRequestSchema,
  ZUpsertMessageTemplateResponseSchema,
} from './message-template.types';

/** Throws UNAUTHORIZED unless the user can manage the organisation. */
const assertCanManageOrganisation = async (organisationId: string, userId: number) => {
  const organisation = await prisma.organisation.findFirst({
    where: buildOrganisationWhereQuery({
      organisationId,
      userId,
      roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
    }),
    select: { id: true },
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.UNAUTHORIZED);
  }
};

export const upsertMessageTemplateRoute = authenticatedProcedure
  .input(ZUpsertMessageTemplateRequestSchema)
  .output(ZUpsertMessageTemplateResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId, channel, event, subject, body } = input;

    await assertCanManageOrganisation(organisationId, ctx.user.id);

    const template = await prisma.messageTemplate.upsert({
      where: {
        organisationId_channel_event: { organisationId, channel, event },
      },
      create: {
        id: generateDatabaseId('message_template'),
        organisationId,
        channel,
        event,
        subject: subject ?? null,
        body,
      },
      update: { subject: subject ?? null, body },
      select: { id: true },
    });

    return { id: template.id };
  });

export const findMessageTemplatesRoute = authenticatedProcedure
  .input(ZFindMessageTemplatesRequestSchema)
  .output(ZFindMessageTemplatesResponseSchema)
  .query(async ({ input, ctx }) => {
    await assertCanManageOrganisation(input.organisationId, ctx.user.id);

    const data = await prisma.messageTemplate.findMany({
      where: { organisationId: input.organisationId },
      select: { id: true, channel: true, event: true, subject: true, body: true },
      orderBy: [{ channel: 'asc' }, { event: 'asc' }],
    });

    return { data };
  });

export const deleteMessageTemplateRoute = authenticatedProcedure
  .input(ZDeleteMessageTemplateRequestSchema)
  .output(ZDeleteMessageTemplateResponseSchema)
  .mutation(async ({ input, ctx }) => {
    await assertCanManageOrganisation(input.organisationId, ctx.user.id);

    await prisma.messageTemplate.deleteMany({
      where: { id: input.id, organisationId: input.organisationId },
    });
  });
