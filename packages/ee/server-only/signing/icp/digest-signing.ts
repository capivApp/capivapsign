import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { PDF, type TimestampAuthority } from '@libpdf/core';

import type { LibpdfSignerAlgo } from '../csc/algorithm-resolver';
import { CscCaptureSigner } from '../csc/signers/capture-signer';
import { CscFifoSigner } from '../csc/signers/fifo-signer';
import type { IcpCertificateInfo } from './icp-cert-policy';

/**
 * The reusable ICP crypto core: capture → embed → seal, all over `@libpdf/core`.
 *
 * This is deliberately identical to the CSC/TSP pipeline — it reuses the very
 * same {@link CscCaptureSigner} / {@link CscFifoSigner} two-pass signers. The
 * ONLY thing the ICP flow swaps out is the middle step: instead of a cloud
 * `signatures/signHash` call, the captured digest is handed to the desktop
 * agent (A1 `.p12` / A3 PKCS#11) which returns the raw signature embedded here.
 *
 * Pure PDF/crypto — no DB, storage, or network beyond the supplied TSA — so it
 * is exercised directly by the Fase 0/1 integration tests with a real signer.
 */

const DEFAULT_DIGEST = 'SHA-256' as const;

/**
 * Bytes reserved for the signature `/Contents` placeholder. libpdf defaults to
 * 12 KB, which overflows for ICP-Brasil: the CMS carries the full ICP chain
 * (leaf + ACs + AC Raiz) AND the B-T signature timestamp token (the TSA's own
 * cert chain), pushing past 14 KB → `PLACEHOLDER_TOO_SMALL`.
 *
 * CRITICAL: the capture and embed passes MUST pass the SAME value. The
 * placeholder size shifts the `/ByteRange` offsets, so a mismatch would make the
 * capture-derived signedAttrs digest disagree with the embedded one — an invalid
 * signature. 32 KB leaves generous headroom for multi-AC chains + TSA tokens.
 */
const ICP_SIGNATURE_ESTIMATED_SIZE = 32768;

/**
 * Derive libpdf's signer algorithm tuple from the parsed leaf certificate.
 * ICP-Brasil A1/A3 are RSA in practice; EC is mapped through for completeness
 * but the desktop signer registry currently emits RSASSA-PKCS1-v1_5 only.
 */
export const deriveSignerAlgo = (info: IcpCertificateInfo): LibpdfSignerAlgo => {
  if (info.keyType === 'EC') {
    return {
      keyType: 'EC',
      signatureAlgorithm: 'ECDSA',
      digestAlgorithm: DEFAULT_DIGEST,
      keyLenBits: info.keyLenBits,
    };
  }

  return {
    keyType: 'RSA',
    signatureAlgorithm: 'RSASSA-PKCS1-v1_5',
    digestAlgorithm: DEFAULT_DIGEST,
    keyLenBits: info.keyLenBits,
  };
};

export type CaptureItemDigestOptions = {
  pdfBytes: Uint8Array;
  certificate: Uint8Array;
  certificateChain: Uint8Array[];
  algo: LibpdfSignerAlgo;
  anchorName: string;
  signingTime: Date;
};

/**
 * Prep pass: drive `pdf.sign` with {@link CscCaptureSigner} to derive the
 * `signedAttrs` digest libpdf would otherwise sign for `anchorName`. The signed
 * PDF is discarded — only the digest matters. Captured at B-B; the eventual
 * embed is B-T (the TSA-attested signature timestamp is a CMS *unsigned*
 * attribute, so B-B and B-T produce byte-identical signed-attrs).
 */
export const captureItemDigest = async (opts: CaptureItemDigestOptions): Promise<Uint8Array> => {
  const pdfDoc = await PDF.load(opts.pdfBytes);

  const captureSigner = new CscCaptureSigner({
    certificate: opts.certificate,
    certificateChain: opts.certificateChain,
    algo: opts.algo,
  });

  await pdfDoc.sign({
    signer: captureSigner,
    fieldName: opts.anchorName,
    signingTime: opts.signingTime,
    level: 'B-B',
    digestAlgorithm: opts.algo.digestAlgorithm,
    estimatedSize: ICP_SIGNATURE_ESTIMATED_SIZE,
  });

  if (captureSigner.capturedDigest === null) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'ICP capture signer was not invoked by pdf.sign.',
    });
  }

  return captureSigner.capturedDigest;
};

export type EmbedItemSignatureOptions = {
  pdfBytes: Uint8Array;
  certificate: Uint8Array;
  certificateChain: Uint8Array[];
  algo: LibpdfSignerAlgo;
  anchorName: string;
  signingTime: Date;
  /** Raw signature bytes produced by the desktop agent over the captured digest. */
  signature: Uint8Array;
  /** RFC3161 TSA for the B-T signature timestamp. */
  timestampAuthority: TimestampAuthority;
};

/**
 * Embed pass: re-run `pdf.sign` over the same bytes with {@link CscFifoSigner},
 * feeding the desktop-produced signature back into `anchorName` at PAdES B-T
 * (per-signature timestamp). Returns the signed PDF bytes.
 */
export const embedItemSignature = async (opts: EmbedItemSignatureOptions): Promise<Uint8Array> => {
  const pdfDoc = await PDF.load(opts.pdfBytes);

  const fifoSigner = new CscFifoSigner({
    certificate: opts.certificate,
    certificateChain: opts.certificateChain,
    algo: opts.algo,
    signatures: [opts.signature],
  });

  const result = await pdfDoc.sign({
    signer: fifoSigner,
    fieldName: opts.anchorName,
    signingTime: opts.signingTime,
    level: 'B-T',
    timestampAuthority: opts.timestampAuthority,
    digestAlgorithm: opts.algo.digestAlgorithm,
    estimatedSize: ICP_SIGNATURE_ESTIMATED_SIZE,
  });

  return result.bytes;
};

export type SealArchivalOptions = {
  pdfBytes: Uint8Array;
  timestampAuthority: TimestampAuthority;
};

export type SealArchivalResult = {
  bytes: Uint8Array;
  signatureCount: number;
};

/**
 * Seal pass: PAdES B-LTA in one call — DSS (certs/OCSP/CRL for every signed
 * field) + an archival `/DocTimeStamp` + DSS for the timestamp's own chain.
 * All append-only incremental updates, so every recipient signature's
 * `/ByteRange` stays valid.
 */
export const sealArchival = async (opts: SealArchivalOptions): Promise<SealArchivalResult> => {
  const pdfDoc = await PDF.load(opts.pdfBytes);
  const archived = await pdfDoc.addArchivalData({ timestampAuthority: opts.timestampAuthority });

  return {
    bytes: archived.bytes,
    signatureCount: archived.signatureCount,
  };
};
