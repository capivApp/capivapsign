import { prisma } from '@documenso/prisma';
import { PDF } from '@libpdf/core';
import { i18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import type { DocumentMeta, Envelope, Field, Recipient, Signature } from '@prisma/client';
import { FieldType } from '@prisma/client';
import { prop, sortBy } from 'remeda';
import { match } from 'ts-pattern';

import { ZSupportedLanguageCodeSchema } from '../../constants/i18n';
import type { TDocumentAuditLogBaseSchema } from '../../types/document-audit-logs';
import { isIcpEnvelope } from '../../types/signature-level';
import { extractDocumentAuthMethods } from '../../utils/document-auth';
import { getTranslations } from '../../utils/i18n';
import { getDocumentCertificateAuditLogs } from '../document/get-document-certificate-audit-logs';
import { getOrganisationClaimByTeamId } from '../organisation/get-organisation-claims';
import { renderCertificate } from './render-certificate';

export type GenerateCertificatePdfOptions = {
  /**
   * Note: completedAt is not included since it's not real at this point in time.
   *
   * If we actually need it here in the future, we will need to preserve the
   * completedAt value and pass it to the final `envelope.update` function when
   * the document is initially sealed.
   */
  envelope: Omit<Envelope, 'completedAt'> & {
    documentMeta: DocumentMeta;
  };
  envelopeOwner: {
    name: string;
    email: string;
  };
  recipients: Recipient[];
  fields: (Pick<Field, 'id' | 'type' | 'secondaryId' | 'recipientId'> & {
    signature?: Pick<Signature, 'signatureImageAsBase64' | 'typedSignature'> | null;
  })[];
  language?: string;
  pageWidth: number;
  pageHeight: number;
  /**
   * Sign-time context for the ICP-Brasil flow. When the certificate page is
   * baked into the signed content at `prepare` (so the signature covers it),
   * the recipient's `DOCUMENT_RECIPIENT_COMPLETED` audit log doesn't exist yet
   * and there's no `Signature` row — so the signer name, signing time and IP/UA
   * are supplied directly here and synthesised onto the page.
   */
  icpSignContext?: {
    signedAt: Date;
    signerNamesByRecipientId: Record<number, string>;
    ipAddress?: string | null;
    userAgent?: string | null;
  };
};

export const generateCertificatePdf = async (options: GenerateCertificatePdfOptions) => {
  const { envelope, envelopeOwner, recipients, fields, language, pageWidth, pageHeight } = options;

  const documentLanguage = ZSupportedLanguageCodeSchema.parse(language);

  const [organisationClaim, auditLogs, messages] = await Promise.all([
    getOrganisationClaimByTeamId({ teamId: envelope.teamId }),
    getDocumentCertificateAuditLogs({
      envelopeId: envelope.id,
    }),
    getTranslations(documentLanguage),
  ]);

  // ICP-Brasil recipients sign with their certificate and never draw/type a
  // signature, so the `Signature` row is empty and the certificate page would
  // show a blank box. Map each ICP signer's certificate common name so we can
  // render it as the signature, mirroring the in-document ICP stamp.
  const icpSignerNameByRecipientId = new Map<number, string>();

  if (isIcpEnvelope(envelope)) {
    const evidence = await prisma.icpSignatureEvidence.findMany({
      where: { envelopeId: envelope.id },
      select: { recipientId: true, signerCommonName: true },
    });

    for (const item of evidence) {
      icpSignerNameByRecipientId.set(item.recipientId, item.signerCommonName);
    }
  }

  // Sign-time overrides (the page is baked at `prepare`, before evidence exists).
  for (const [recipientId, name] of Object.entries(options.icpSignContext?.signerNamesByRecipientId ?? {})) {
    icpSignerNameByRecipientId.set(Number(recipientId), name);
  }

  i18n.loadAndActivate({
    locale: documentLanguage,
    messages,
  });

  const payload = {
    recipients: recipients.map((recipient) => {
      const recipientId = recipient.id;

      let signatureField = fields.find(
        (field) => field.recipientId === recipient.id && field.type === FieldType.SIGNATURE,
      );

      // For an ICP signer with no drawn/typed signature, synthesise a typed
      // signature from their certificate common name so the certificate page
      // shows who signed instead of an empty box.
      const icpSignerName = icpSignerNameByRecipientId.get(recipient.id);

      if (
        signatureField &&
        icpSignerName &&
        !signatureField.signature?.signatureImageAsBase64 &&
        !signatureField.signature?.typedSignature
      ) {
        signatureField = {
          ...signatureField,
          signature: { signatureImageAsBase64: null, typedSignature: icpSignerName },
        };
      }

      const emailSent: TDocumentAuditLogBaseSchema | undefined = auditLogs['EMAIL_SENT'].find(
        (log) => log.type === 'EMAIL_SENT' && log.data.recipientId === recipientId,
      );

      const documentSent: TDocumentAuditLogBaseSchema | undefined = auditLogs['DOCUMENT_SENT'].find(
        (log) => log.type === 'DOCUMENT_SENT',
      );

      const documentOpened: TDocumentAuditLogBaseSchema | undefined = auditLogs['DOCUMENT_OPENED'].find(
        (log) => log.type === 'DOCUMENT_OPENED' && log.data.recipientId === recipientId,
      );

      let documentRecipientCompleted: TDocumentAuditLogBaseSchema | undefined = auditLogs[
        'DOCUMENT_RECIPIENT_COMPLETED'
      ].find((log) => log.type === 'DOCUMENT_RECIPIENT_COMPLETED' && log.data.recipientId === recipientId);

      // Bake-time: no completed log yet. Synthesise the signing event so the
      // page shows Signed time + IP/Device for the ICP signer being baked.
      if (!documentRecipientCompleted && options.icpSignContext && icpSignerNameByRecipientId.has(recipientId)) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        documentRecipientCompleted = {
          createdAt: options.icpSignContext.signedAt,
          ipAddress: options.icpSignContext.ipAddress ?? null,
          userAgent: options.icpSignContext.userAgent ?? null,
        } as TDocumentAuditLogBaseSchema;
      }

      const documentRecipientRejected: TDocumentAuditLogBaseSchema | undefined = auditLogs[
        'DOCUMENT_RECIPIENT_REJECTED'
      ].find((log) => log.type === 'DOCUMENT_RECIPIENT_REJECTED' && log.data.recipientId === recipientId);

      const extractedAuthMethods = extractDocumentAuthMethods({
        documentAuth: envelope.authOptions,
        recipientAuth: recipient.authOptions,
      });

      const insertedAuditLogsWithFieldAuth = sortBy(
        auditLogs.DOCUMENT_FIELD_INSERTED.filter(
          (log) => log.data.recipientId === recipient.id && log.data.fieldSecurity,
        ),
        [prop('createdAt'), 'desc'],
      );

      const actionAuthMethod = insertedAuditLogsWithFieldAuth.at(0)?.data?.fieldSecurity?.type;

      let authLevel = match(actionAuthMethod)
        .with('ACCOUNT', () => i18n._(msg`Account Re-Authentication`))
        .with('TWO_FACTOR_AUTH', () => i18n._(msg`Two-Factor Re-Authentication`))
        .with('PASSWORD', () => i18n._(msg`Password Re-Authentication`))
        .with('PASSKEY', () => i18n._(msg`Passkey Re-Authentication`))
        .with('EXPLICIT_NONE', () => i18n._(msg`Email`))
        .with(undefined, () => null)
        .exhaustive();

      if (!authLevel) {
        const accessAuthMethod = extractedAuthMethods.derivedRecipientAccessAuth.at(0);

        authLevel = match(accessAuthMethod)
          .with('ACCOUNT', () => i18n._(msg`Account Authentication`))
          .with('TWO_FACTOR_AUTH', () => i18n._(msg`Two-Factor Authentication`))
          .with(undefined, () => i18n._(msg`Email`))
          .exhaustive();
      }

      return {
        id: recipient.id,
        name: recipient.name,
        email: recipient.email,
        role: recipient.role,
        signingStatus: recipient.signingStatus,
        signatureField,
        rejectionReason: recipient.rejectionReason,
        authLevel,
        logs: {
          emailed: emailSent ?? null,
          sent: documentSent ?? null,
          opened: documentOpened ?? null,
          completed: documentRecipientCompleted ?? null,
          rejected: documentRecipientRejected ?? null,
        },
      };
    }),
    envelopeOwner,
    envelopeId: envelope.id,
    qrToken: envelope.qrToken,
    hidePoweredBy: organisationClaim.flags.hidePoweredBy ?? false,
    dateFormat: envelope.documentMeta.dateFormat ?? 'yyyy-MM-dd hh:mm a',
    pageWidth,
    pageHeight,
    i18n,
  };

  const certificatePages = await renderCertificate(payload);

  return await PDF.merge(certificatePages);
};
