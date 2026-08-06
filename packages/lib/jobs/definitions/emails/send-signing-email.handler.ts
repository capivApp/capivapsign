import DocumentInviteEmailTemplate from '@documenso/email/templates/document-invite';
import { isRecipientEmailValidForSending } from '@documenso/lib/utils/recipients';
import { prisma } from '@documenso/prisma';
import { msg } from '@lingui/core/macro';
import {
  BillableEventType,
  DocumentSource,
  DocumentStatus,
  EnvelopeType,
  MessageTemplateChannel,
  MessageTemplateEvent,
  OrganisationType,
  RecipientRole,
  SendStatus,
} from '@prisma/client';
import { createElement } from 'react';

import { getI18nInstance } from '../../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../../constants/app';
import { RECIPIENT_ROLE_TO_EMAIL_TYPE, RECIPIENT_ROLES_DESCRIPTION } from '../../../constants/recipient-roles';
import { recordUsage } from '../../../server-only/billing/record-usage';
import { buildEnvelopeEmailHeaders } from '../../../server-only/email/build-envelope-email-headers';
import { getEmailContext } from '../../../server-only/email/get-email-context';
import { resolveMessageTemplate } from '../../../server-only/messaging/resolve-message-template';
import { assertOrganisationRatesAndLimits } from '../../../server-only/rate-limit/assert-organisation-rates-and-limits';
import { updateRecipientNextReminder } from '../../../server-only/recipient/update-recipient-next-reminder';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../../types/document-audit-logs';
import { extractDerivedDocumentEmailSettings } from '../../../types/document-email';
import { createDocumentAuditLogData } from '../../../utils/document-audit-logs';
import { unsafeBuildEnvelopeIdQuery } from '../../../utils/envelope';
import { renderCustomEmailTemplate } from '../../../utils/render-custom-email-template';
import { renderEmailWithI18N } from '../../../utils/render-email-with-i18n';
import { renderFullHtmlMessageTemplate } from '../../../utils/render-message-template-html';
import type { JobRunIO } from '../../client/_internal/job';
import type { TSendSigningEmailJobDefinition } from './send-signing-email';

export const run = async ({ payload, io }: { payload: TSendSigningEmailJobDefinition; io: JobRunIO }) => {
  const { userId, documentId, recipientId, requestMetadata, source } = payload;

  const [user, envelope, recipient] = await Promise.all([
    prisma.user.findFirstOrThrow({
      where: {
        id: userId,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    }),
    prisma.envelope.findFirstOrThrow({
      where: {
        ...unsafeBuildEnvelopeIdQuery(
          {
            type: 'documentId',
            id: documentId,
          },
          EnvelopeType.DOCUMENT,
        ),
        status: DocumentStatus.PENDING,
      },
      include: {
        documentMeta: true,
        user: {
          select: {
            disabled: true,
          },
        },
        team: {
          select: {
            teamEmail: true,
            name: true,
          },
        },
      },
    }),
    prisma.recipient.findFirstOrThrow({
      where: {
        id: recipientId,
      },
    }),
  ]);

  const { documentMeta, team } = envelope;

  if (recipient.role === RecipientRole.CC) {
    return;
  }

  const isRecipientSigningRequestEmailEnabled = extractDerivedDocumentEmailSettings(
    envelope.documentMeta,
  ).recipientSigningRequest;

  if (!isRecipientSigningRequestEmailEnabled) {
    return;
  }

  const {
    branding,
    emailLanguage,
    settings,
    organisationType,
    senderEmail,
    replyToEmail,
    organisationId,
    claims,
    emailsDisabled,
    emailTransport,
  } = await getEmailContext({
    emailType: 'RECIPIENT',
    source: {
      type: 'team',
      teamId: envelope.teamId,
    },
    meta: envelope.documentMeta,
  });

  // Don't send signing invitations if the organisation has email sending disabled or the owner is disabled (e.g. banned).
  if (envelope.user.disabled || emailsDisabled) {
    return;
  }

  const customEmail = envelope?.documentMeta;
  const isDirectTemplate = envelope.source === DocumentSource.TEMPLATE_DIRECT_LINK;

  const recipientEmailType = RECIPIENT_ROLE_TO_EMAIL_TYPE[recipient.role];

  const { email, name } = recipient;
  const selfSigner = email === user.email;

  const i18n = await getI18nInstance(emailLanguage);

  const recipientActionVerb = i18n._(RECIPIENT_ROLES_DESCRIPTION[recipient.role].actionVerb).toLowerCase();

  let emailMessage = customEmail?.message || '';
  let emailSubject = i18n._(msg`Please ${recipientActionVerb} this document`);

  if (selfSigner) {
    emailMessage = i18n._(
      msg`You have initiated the document ${`"${envelope.title}"`} that requires you to ${recipientActionVerb} it.`,
    );
    emailSubject = i18n._(msg`Please ${recipientActionVerb} your document`);
  }

  if (isDirectTemplate) {
    emailMessage = i18n._(
      msg`A document was created by your direct template that requires you to ${recipientActionVerb} it.`,
    );
    emailSubject = i18n._(msg`Please ${recipientActionVerb} this document created by your direct template`);
  }

  if (organisationType === OrganisationType.ORGANISATION) {
    emailSubject = i18n._(msg`${team.name} invited you to ${recipientActionVerb} a document`);
    emailMessage = customEmail?.message ?? '';

    if (!emailMessage) {
      const inviterName = user.name || '';

      emailMessage = i18n._(
        settings.includeSenderDetails
          ? msg`${inviterName} on behalf of "${team.name}" has invited you to ${recipientActionVerb} the document "${envelope.title}".`
          : msg`${team.name} has invited you to ${recipientActionVerb} the document "${envelope.title}".`,
      );
    }
  }

  // Org-managed email template (if any) overrides the default subject/body.
  const orgTemplate = await resolveMessageTemplate({
    organisationId,
    channel: MessageTemplateChannel.EMAIL,
    event: MessageTemplateEvent.SIGNING_REQUEST,
  });

  if (orgTemplate) {
    emailMessage = orgTemplate.body;

    if (orgTemplate.subject) {
      emailSubject = orgTemplate.subject;
    }
  }

  const assetBaseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000';
  const signDocumentLink = `${NEXT_PUBLIC_WEBAPP_URL()}/sign/${recipient.token}`;
  const reportUrl = `${NEXT_PUBLIC_WEBAPP_URL()}/report/${recipient.token}`;

  const customEmailTemplate = {
    'signer.name': name,
    'signer.email': email,
    'document.name': envelope.title,
    'team.name': team?.name ?? '',
    subject: emailSubject,
    link: signDocumentLink,
    // Aliases kept for backwards compatibility with older templates.
    'document.url': signDocumentLink,
    'signing.link': signDocumentLink,
  };

  // When the org/admin template is a full HTML document, render it verbatim as
  // the email instead of embedding it inside the default CapivaSign layout.
  const fullHtmlEmail = orgTemplate ? renderFullHtmlMessageTemplate(orgTemplate.body, customEmailTemplate) : null;

  const template = createElement(DocumentInviteEmailTemplate, {
    documentName: envelope.title,
    inviterName: user.name || undefined,
    inviterEmail:
      organisationType === OrganisationType.ORGANISATION ? team?.teamEmail?.email || user.email : user.email,
    assetBaseUrl,
    signDocumentLink,
    customBody: renderCustomEmailTemplate(emailMessage, customEmailTemplate),
    role: recipient.role,
    selfSigner,
    organisationType,
    teamName: team?.name,
    teamEmail: team?.teamEmail?.email,
    includeSenderDetails: settings.includeSenderDetails,
    reportUrl,
  });

  if (isRecipientEmailValidForSending(recipient)) {
    try {
      await assertOrganisationRatesAndLimits({
        organisationId,
        organisationClaim: claims,
        type: 'email',
        count: 1,
      });
    } catch (_err) {
      io.logger.warn({
        msg: 'Recipient signing email dropped: org rate limit exceeded',
        organisationId,
        recipientId: recipient.id,
        envelopeId: envelope.id,
      });

      // Job is consumed and NOT retried.
      return;
    }

    await io.runTask('send-signing-email', async () => {
      const [html, text] = fullHtmlEmail
        ? [fullHtmlEmail.html, fullHtmlEmail.text]
        : await Promise.all([
            renderEmailWithI18N(template, { lang: emailLanguage, branding }),
            renderEmailWithI18N(template, {
              lang: emailLanguage,
              branding,
              plainText: true,
            }),
          ]);

      await emailTransport.sendMail({
        to: {
          name: recipient.name,
          address: recipient.email,
        },
        from: senderEmail,
        replyTo: replyToEmail,
        subject: renderCustomEmailTemplate(documentMeta?.subject || emailSubject, customEmailTemplate),
        html,
        text,
        headers: buildEnvelopeEmailHeaders({
          userId,
          envelopeId: envelope.id,
          teamId: envelope.teamId,
        }),
      });
    });

    // Bill the email only when the send originated from the API.
    await recordUsage({
      type: BillableEventType.EMAIL_MESSAGE,
      source: source ?? 'app',
      organisationId,
      teamId: envelope.teamId,
      metadata: { envelopeId: envelope.id, recipientId: recipient.id },
    });
  }

  const sentAt = new Date();

  await io.runTask('update-recipient', async () => {
    await prisma.recipient.update({
      where: {
        id: recipient.id,
      },
      data: {
        sendStatus: SendStatus.SENT,
        sentAt,
      },
    });
  });

  // Compute the first reminder time based on the envelope's effective settings.
  await updateRecipientNextReminder({
    recipientId: recipient.id,
    envelopeId: envelope.id,
    sentAt,
    lastReminderSentAt: null,
  });

  await prisma.documentAuditLog.create({
    data: createDocumentAuditLogData({
      type: DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT,
      envelopeId: envelope.id,
      user,
      requestMetadata,
      data: {
        emailType: recipientEmailType,
        recipientId: recipient.id,
        recipientName: recipient.name,
        recipientEmail: recipient.email,
        recipientRole: recipient.role,
        isResending: false,
      },
    }),
  });
};
