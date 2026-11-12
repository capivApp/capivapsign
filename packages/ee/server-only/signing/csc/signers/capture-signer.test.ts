import { sha256 } from '@noble/hashes/sha2';
import { describe, expect, it } from 'vitest';

import { CscCaptureSigner } from './capture-signer';

const SIGNED_ATTRS = new TextEncoder().encode('signedAttrs DER stand-in');

const buildSigner = () =>
  new CscCaptureSigner({
    certificate: new Uint8Array(),
    algo: { keyType: 'RSA', signatureAlgorithm: 'RSASSA-PKCS1-v1_5', digestAlgorithm: 'SHA-256', keyLenBits: 2048 },
  });

describe('CscCaptureSigner', () => {
  it('keeps the signedAttrs bytes next to their digest', async () => {
    const signer = buildSigner();

    await signer.sign(SIGNED_ATTRS, 'SHA-256');

    expect(signer.capturedSignedAttrs).toEqual(SIGNED_ATTRS);
    expect(signer.capturedDigest).toEqual(sha256(SIGNED_ATTRS));
  });
});
