import { type KeyObject, verify } from 'node:crypto';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';

type DigestAlgorithm = 'SHA-256' | 'SHA-384' | 'SHA-512';

const NODE_DIGEST_NAME: Record<DigestAlgorithm, string> = {
  'SHA-256': 'sha256',
  'SHA-384': 'sha384',
  'SHA-512': 'sha512',
};

export type AssertSignatureMatchesKeyOptions = {
  publicKey: KeyObject;
  signedAttrs: Uint8Array;
  signature: Uint8Array;
  digestAlgo: DigestAlgorithm;
};

/**
 * Refuses a desktop-produced signature that does not verify over `signedAttrs`
 * with the leaf certificate's key, before it is embedded. Without this an
 * agent bug (e.g. a PKCS#1 block missing its DigestInfo) silently ships a PDF
 * the ITI validator rejects as "Cifra assimétrica: Reprovada".
 *
 * RSA keys verify as RSASSA-PKCS1-v1_5 and EC keys as DER ECDSA, node's
 * defaults for each key type.
 */
export const assertSignatureMatchesKey = (opts: AssertSignatureMatchesKeyOptions): void => {
  const { publicKey, signedAttrs, signature, digestAlgo } = opts;

  if (verify(NODE_DIGEST_NAME[digestAlgo], signedAttrs, publicKey, signature)) {
    return;
  }

  // Reaches the signer through the desktop agent's error dialog.
  throw new AppError(AppErrorCode.INVALID_REQUEST, {
    message:
      'A assinatura gerada não confere com o certificado escolhido. Atualize o CapivaSign Desktop e tente de novo.',
  });
};
