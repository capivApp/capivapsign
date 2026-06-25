import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { buildIcpStampOverlay } from '@documenso/lib/server-only/pdf/render-icp-stamp';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { TIcpCertType, TIcpSignSessionItems } from '@documenso/lib/types/icp-sign-session';
import { isIcpEnvelope } from '@documenso/lib/types/signature-level';
import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { getFileServerSide } from '@documenso/lib/universal/upload/get-file.server';
import { putPdfFileServerSide } from '@documenso/lib/universal/upload/put-file.server';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';
import { PDF } from '@libpdf/core';
import { FieldType, RecipientRole } from '@prisma/client';
import { DateTime } from 'luxon';

import { buildTspAnchorName, buildTspStampName } from '../csc/pdf-names';
import { injectOverlayIntoStamp } from '../csc/render-overlay';
import type { TIcpPrepareResponse } from './desktop-protocol';
import { captureItemDigest, deriveSignerAlgo } from './digest-signing';
import { assertSignableIcpCertificate, parseIcpCertificate } from './icp-cert-policy';
import { upsertIcpSignSession } from './sign-session';

/**
 * ICP-Brasil prep-phase orchestrator — the digest-capture half of the
 * desktop-driven flow. Mirror of `csc/prepare-recipient-signing.ts`, but the
 * signing certificate is supplied by the desktop (the recipient's A1/A3
 * credential) rather than fetched from a stored CSC credential, and there is no
 * OAuth redirect — the desktop signs locally and calls `complete` next.
 *
 * Per envelope item:
 *   1. Persist the current (already anchor-materialised) bytes as an immutable
 *      orphan `DocumentData` row — the byte-source the embed pass reloads.
 *   2. Reload and dry-run `pdf.sign` with the capture signer to derive the
 *      signedAttrs digest, captured with the SAME leaf cert the embed will use.
 *
 * The pinned `{ envelopeItemId, documentDataId, hashB64, ordinal }` tuples plus
 * the leaf-first cert chain + hardware tier are stored on the session.
 */

export type PrepareIcpRecipientSigningOptions = {
  recipientToken: string;
  /** Leaf-first DER cert chain (base64) chosen on the desktop. */
  certChainB64: string[];
  certType: TIcpCertType;
  requestMetadata?: RequestMetadata;
};

export const prepareIcpRecipientSigning = async (
  opts: PrepareIcpRecipientSigningOptions,
): Promise<TIcpPrepareResponse> => {
  const { recipientToken, certChainB64, certType, requestMetadata } = opts;

  const recipient = await prisma.recipient
    .findFirst({
      where: { token: recipientToken },
      // Fields + signatures are needed to render the ICP signature stamp into
      // the materialised stamp annotation at the field's position.
      include: { fields: { include: { signature: true } } },
    })
    .catch(() => null);

  if (!recipient) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: `Recipient with token "${recipientToken}" not found.`,
    });
  }

  const envelope = await prisma.envelope.findUniqueOrThrow({
    where: { id: recipient.envelopeId },
    include: { envelopeItems: { include: { documentData: true } }, documentMeta: true },
  });

  if (!isIcpEnvelope(envelope)) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'prepareIcpRecipientSigning called for a non-ICP envelope.',
    });
  }

  const leafDer = new Uint8Array(Buffer.from(certChainB64[0], 'base64'));
  const certInfo = parseIcpCertificate(leafDer);

  // Pin a single signingTime so the embed pass re-derives byte-identical
  // signedAttrs digests.
  const signingTime = new Date();
  assertSignableIcpCertificate(certInfo, signingTime);

  const algo = deriveSignerAlgo(certInfo);
  const items: TIcpSignSessionItems = [];

  for (const envelopeItem of envelope.envelopeItems) {
    // Persist the current bytes (anchors already materialised at send time) as
    // the immutable byte-source the embed pass will reload. Re-loading from the
    // persisted copy guarantees the capture digest matches the embed input.
    const bytes = await getFileServerSide(envelopeItem.documentData);
    const pdfDoc = await PDF.load(bytes);

    // Render the recipient's signature stamp at their field positions BEFORE
    // pinning the bytes, so it is part of what gets captured + signed. ICP
    // recipients don't draw — the SIGNATURE field is auto-filled with a typed
    // signature of the certificate's holder name, rendered through the same
    // pipeline the SES/TSP overlays use (so the stamp lands at the field rect).
    const signatureFieldsOnItem = recipient.fields.filter(
      (field) => field.envelopeItemId === envelopeItem.id && field.type === FieldType.SIGNATURE,
    );
    const pagesWithFields = new Set(signatureFieldsOnItem.map((field) => field.page));
    const dateText = DateTime.fromJSDate(signingTime).toFormat(
      `${envelope.documentMeta?.dateFormat ?? 'dd/MM/yyyy HH:mm'}`,
    );

    for (const pageNumber of pagesWithFields) {
      const page = pdfDoc.getPage(pageNumber - 1);

      if (!page) {
        continue;
      }

      const overlayBytes = await buildIcpStampOverlay({
        pageWidth: page.width,
        pageHeight: page.height,
        fields: signatureFieldsOnItem
          .filter((field) => field.page === pageNumber)
          .map((field) => ({
            positionX: Number(field.positionX),
            positionY: Number(field.positionY),
            width: Number(field.width),
            height: Number(field.height),
          })),
        signerName: certInfo.commonName,
        roleLabel: ICP_ROLE_LABEL[recipient.role],
        dateText,
      });

      await injectOverlayIntoStamp({
        pdfDoc,
        stampName: buildTspStampName(recipient.id, envelopeItem.id, pageNumber),
        pageNumber,
        overlayBytes,
      });
    }

    const pinnedBytes = await pdfDoc.save({ incremental: true });

    const fileName = envelope.title.endsWith('.pdf') ? envelope.title : `${envelope.title || 'envelope'}.pdf`;
    const pinnedUpload = await putPdfFileServerSide(
      {
        name: fileName,
        type: 'application/pdf',
        arrayBuffer: async () => Promise.resolve(pinnedBytes),
      },
      envelopeItem.documentData.initialData ?? undefined,
    );

    const digest = await captureItemDigest({
      pdfBytes: pinnedBytes,
      certificate: leafDer,
      certificateChain: [],
      algo,
      anchorName: buildTspAnchorName(recipient.id, envelopeItem.id),
      signingTime,
    });

    items.push({
      envelopeItemId: envelopeItem.id,
      documentDataId: pinnedUpload.documentData.id,
      hashB64: Buffer.from(digest).toString('base64'),
      ordinal: items.length,
    });
  }

  const session = await upsertIcpSignSession({
    recipientId: recipient.id,
    envelopeId: envelope.id,
    signingTime,
    items,
    certChain: certChainB64,
    certType,
  });

  await prisma.documentAuditLog.create({
    data: createDocumentAuditLogData({
      type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_ICP_SIGN_REQUESTED,
      envelopeId: envelope.id,
      user: { name: recipient.name, email: recipient.email },
      requestMetadata,
      data: {
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        recipientId: recipient.id,
        recipientRole: recipient.role,
        sessionId: session.id,
        certType,
        signerCpfCnpj: certInfo.cpfCnpj,
        numSignatures: items.length,
      },
    }),
  });

  return {
    sessionId: session.id,
    items: items.map((item) => ({ envelopeItemId: item.envelopeItemId, digestB64: item.hashB64 })),
    policy: {
      digestAlgo: algo.digestAlgorithm,
      signAlgo: algo.signatureAlgorithm,
    },
  };
};

/** Portuguese recipient-role label shown on the ICP signature stamp. */
const ICP_ROLE_LABEL: Record<RecipientRole, string> = {
  [RecipientRole.SIGNER]: 'Signatário',
  [RecipientRole.APPROVER]: 'Aprovador',
  [RecipientRole.CC]: 'Cópia',
  [RecipientRole.VIEWER]: 'Visualizador',
  [RecipientRole.ASSISTANT]: 'Assistente',
};
