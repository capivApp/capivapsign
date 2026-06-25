import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { jobs } from '@documenso/lib/jobs/client';
import { sendPendingEmail } from '@documenso/lib/server-only/document/send-pending-email';
import { triggerWebhook } from '@documenso/lib/server-only/webhooks/trigger/trigger-webhook';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import { mapEnvelopeToWebhookDocumentPayload, ZWebhookDocumentSchema } from '@documenso/lib/types/webhook-payload';
import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { getFileServerSide } from '@documenso/lib/universal/upload/get-file.server';
import { putPdfFileServerSide } from '@documenso/lib/universal/upload/put-file.server';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';
import { RecipientRole, SendStatus, SigningStatus, WebhookTriggerEvents } from '@prisma/client';

import { buildTspAnchorName } from '../csc/pdf-names';
import type { TIcpCompleteRequest, TIcpCompleteResponse } from './desktop-protocol';
import { captureItemDigest, deriveSignerAlgo, embedItemSignature } from './digest-signing';
import { parseIcpCertificate } from './icp-cert-policy';
import { resolveIcpTimestampAuthority } from './icp-tsa';
import { consumeIcpSignSession, loadIcpSignSession } from './sign-session';

/**
 * ICP-Brasil complete-phase orchestrator — the embed half of the
 * desktop-driven flow. Mirror of `csc/execute-tsp-sign.ts`, but the signatures
 * come from the desktop agent (over the digests `prepare` captured) rather than
 * from a cloud `signatures/signHash` call, and the cert chain + signingTime are
 * pinned on the session.
 *
 * Two passes over the session-pinned bytes:
 *   1. Re-capture each item's signedAttrs digest and assert it matches the
 *      prep-time hash bit-for-bit (anti-mutation; throws on divergence).
 *   2. Embed the desktop signature into the same anchor at PAdES B-T.
 *
 * Output bytes are copied in-place onto `envelopeItem.documentData`; the
 * recipient flips to SIGNED and, when everyone has signed, the B-LTA seal job
 * is scheduled. All persistence is one transaction.
 */

export type CompleteIcpRecipientSigningOptions = TIcpCompleteRequest & {
  requestMetadata?: RequestMetadata;
};

export const completeIcpRecipientSigning = async (
  opts: CompleteIcpRecipientSigningOptions,
): Promise<TIcpCompleteResponse> => {
  const { sessionId, items: signedItems, requestMetadata } = opts;

  const session = await loadIcpSignSession(sessionId);

  if (!session) {
    throw new AppError(AppErrorCode.NOT_FOUND, { message: `ICP sign session "${sessionId}" not found.` });
  }

  const recipient = await prisma.recipient.findUnique({ where: { id: session.recipientId } });

  if (!recipient) {
    throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Recipient for ICP session not found.' });
  }

  // Idempotency: a retry after a successful complete finds the recipient
  // already flipped — return success rather than re-embedding.
  if (recipient.signingStatus === SigningStatus.SIGNED) {
    return { outcome: 'already_signed' };
  }

  const chain = session.certChain.map((b64) => new Uint8Array(Buffer.from(b64, 'base64')));
  const certInfo = parseIcpCertificate(chain[0]);
  const algo = deriveSignerAlgo(certInfo);
  const timestampAuthority = resolveIcpTimestampAuthority();

  const envelope = await prisma.envelope.findUniqueOrThrow({
    where: { id: session.envelopeId },
    include: { envelopeItems: { include: { documentData: true } } },
  });

  const signatureByItem = new Map(signedItems.map((item) => [item.envelopeItemId, item.signatureB64]));

  type ItemUpdate = { envelopeItemDataId: string; uploadedType: string; uploadedData: string; envelopeItemId: string };
  const updates: ItemUpdate[] = [];

  // Iterate the session items in pinned order so each embed targets the bytes
  // whose digest the desktop signed.
  for (const sessionItem of session.items) {
    const envelopeItem = envelope.envelopeItems.find((item) => item.id === sessionItem.envelopeItemId);

    if (!envelopeItem) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Session references envelope item "${sessionItem.envelopeItemId}" not on envelope.`,
      });
    }

    const signatureB64 = signatureByItem.get(sessionItem.envelopeItemId);

    if (!signatureB64) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `No signature submitted for envelope item "${sessionItem.envelopeItemId}".`,
      });
    }

    const pinnedDocumentData = await prisma.documentData.findUniqueOrThrow({
      where: { id: sessionItem.documentDataId },
    });
    const pinnedBytes = await getFileServerSide(pinnedDocumentData);
    const anchorName = buildTspAnchorName(recipient.id, envelopeItem.id);

    // Anti-mutation: re-derive the digest and assert it matches the pinned
    // prep-time hash. Divergence means the pinned bytes were tampered with or
    // libpdf changed between prep and complete.
    const recaptured = await captureItemDigest({
      pdfBytes: pinnedBytes,
      certificate: chain[0],
      certificateChain: chain.slice(1),
      algo,
      anchorName,
      signingTime: session.signingTime,
    });

    if (Buffer.from(recaptured).toString('base64') !== sessionItem.hashB64) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Re-derived ICP digest diverged from prep-time hash for envelope item "${envelopeItem.id}".`,
      });
    }

    const signedBytes = await embedItemSignature({
      pdfBytes: pinnedBytes,
      certificate: chain[0],
      certificateChain: chain.slice(1),
      algo,
      anchorName,
      signingTime: session.signingTime,
      signature: new Uint8Array(Buffer.from(signatureB64, 'base64')),
      timestampAuthority,
    });

    const fileName = envelope.title.endsWith('.pdf') ? envelope.title : `${envelope.title || 'envelope'}.pdf`;
    const uploaded = await putPdfFileServerSide(
      {
        name: fileName,
        type: 'application/pdf',
        arrayBuffer: async () => Promise.resolve(signedBytes),
      },
      envelopeItem.documentData.initialData ?? undefined,
    );

    updates.push({
      envelopeItemDataId: envelopeItem.documentDataId,
      uploadedType: uploaded.documentData.type,
      uploadedData: uploaded.documentData.data,
      envelopeItemId: envelopeItem.id,
    });
  }

  const legacyDocumentId = mapSecondaryIdToDocumentId(envelope.secondaryId);

  await prisma.$transaction(async (tx) => {
    for (const { envelopeItemDataId, uploadedType, uploadedData } of updates) {
      await tx.documentData.update({
        where: { id: envelopeItemDataId },
        data: { type: uploadedType as never, data: uploadedData },
      });
    }

    await tx.recipient.update({
      where: { id: recipient.id },
      data: { signingStatus: SigningStatus.SIGNED, signedAt: new Date() },
    });

    // Mark the recipient's fields as inserted. ICP recipients sign with their
    // certificate (the stamp is rendered into the PDF at prepare), never through
    // the interactive field-insertion UI — so the fields stay `inserted: false`.
    // The seal job rejects any required field left uninserted
    // (`fieldsContainUnsignedRequiredField`), so flip them here.
    await tx.field.updateMany({
      where: { recipientId: recipient.id, envelopeId: envelope.id },
      data: { inserted: true },
    });

    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_ICP_SIGNED,
        envelopeId: envelope.id,
        user: { name: recipient.name, email: recipient.email },
        requestMetadata,
        data: {
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          recipientId: recipient.id,
          recipientRole: recipient.role,
          sessionId,
          certType: session.certType,
          signerCpfCnpj: certInfo.cpfCnpj,
          numItemsSigned: updates.length,
          signatureAlgorithm: algo.signatureAlgorithm,
          digestAlgorithm: algo.digestAlgorithm,
        },
      }),
    });

    // Queryable evidence index (the authoritative LTV lives in the PDF DSS).
    for (const update of updates) {
      await tx.icpSignatureEvidence.create({
        data: {
          envelopeId: envelope.id,
          recipientId: recipient.id,
          envelopeItemId: update.envelopeItemId,
          certType: session.certType,
          signerCommonName: certInfo.commonName,
          signerCpfCnpj: certInfo.cpfCnpj,
          certSerial: certInfo.serialHex,
          issuerDn: certInfo.issuerDn,
          certNotAfter: certInfo.notAfter,
          digestAlgorithm: algo.digestAlgorithm,
          signatureAlgorithm: algo.signatureAlgorithm,
          signingTime: session.signingTime,
          padesLevel: 'B-T',
        },
      });
    }

    await consumeIcpSignSession(sessionId, tx);
  });

  // Post-tx side effects (mirrors executeTspSign).
  const envelopeWithRelations = await prisma.envelope.findUniqueOrThrow({
    where: { id: envelope.id },
    include: { documentMeta: true, recipients: true },
  });

  await triggerWebhook({
    event: WebhookTriggerEvents.DOCUMENT_RECIPIENT_COMPLETED,
    data: ZWebhookDocumentSchema.parse(mapEnvelopeToWebhookDocumentPayload(envelopeWithRelations)),
    userId: envelope.userId,
    teamId: envelope.teamId,
  });

  await jobs.triggerJob({
    name: 'send.recipient.signed.email',
    payload: { documentId: legacyDocumentId, recipientId: recipient.id },
  });

  const pendingRecipients = await prisma.recipient.findMany({
    select: { id: true, signingOrder: true, role: true },
    where: {
      envelopeId: envelope.id,
      signingStatus: { not: SigningStatus.SIGNED },
      role: { not: RecipientRole.CC },
    },
    orderBy: [{ signingOrder: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
  });

  if (pendingRecipients.length > 0) {
    await sendPendingEmail({ id: { type: 'envelopeId', id: envelope.id }, recipientId: recipient.id });

    const [nextRecipient] = pendingRecipients;

    await prisma.recipient.update({
      where: { id: nextRecipient.id },
      data: { sendStatus: SendStatus.SENT, sentAt: new Date() },
    });

    await jobs.triggerJob({
      name: 'send.signing.requested.email',
      payload: {
        userId: envelope.userId,
        documentId: legacyDocumentId,
        recipientId: nextRecipient.id,
        requestMetadata,
      },
    });
  }

  const haveAllRecipientsSigned = await prisma.envelope.findFirst({
    where: {
      id: envelope.id,
      recipients: { every: { OR: [{ signingStatus: SigningStatus.SIGNED }, { role: RecipientRole.CC }] } },
    },
  });

  if (haveAllRecipientsSigned) {
    await jobs.triggerJob({
      name: 'internal.seal-document',
      payload: { documentId: legacyDocumentId, requestMetadata },
    });
  }

  return { outcome: 'signed' };
};
