import { constants, createHash, generateKeyPairSync, privateEncrypt, sign } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { assertSignatureMatchesKey } from './assert-signature-matches-key';

const SIGNED_ATTRS = new TextEncoder().encode('signedAttrs DER stand-in');

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

describe('assertSignatureMatchesKey', () => {
  it('accepts an RSASSA-PKCS1-v1_5 signature over the signedAttrs', () => {
    const signature = new Uint8Array(sign('sha256', SIGNED_ATTRS, privateKey));

    expect(() =>
      assertSignatureMatchesKey({ publicKey, signedAttrs: SIGNED_ATTRS, signature, digestAlgo: 'SHA-256' }),
    ).not.toThrow();
  });

  // What SunMSCAPI NONEwithRSA returns: PKCS#1 padding over the bare hash, no DigestInfo.
  it('rejects a signature over the bare hash without DigestInfo', () => {
    const bareHash = createHash('sha256').update(SIGNED_ATTRS).digest();
    const signature = new Uint8Array(
      privateEncrypt({ key: privateKey, padding: constants.RSA_PKCS1_PADDING }, bareHash),
    );

    expect(() =>
      assertSignatureMatchesKey({ publicKey, signedAttrs: SIGNED_ATTRS, signature, digestAlgo: 'SHA-256' }),
    ).toThrow();
  });

  it('rejects a signature made by another key', () => {
    const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const signature = new Uint8Array(sign('sha256', SIGNED_ATTRS, other.privateKey));

    expect(() =>
      assertSignatureMatchesKey({ publicKey, signedAttrs: SIGNED_ATTRS, signature, digestAlgo: 'SHA-256' }),
    ).toThrow();
  });
});
