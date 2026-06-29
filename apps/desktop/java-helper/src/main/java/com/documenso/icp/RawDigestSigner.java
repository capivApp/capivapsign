package com.documenso.icp;

import java.security.PrivateKey;
import java.security.Provider;
import javax.crypto.Cipher;
import java.security.Signature;

/**
 * Strategy: turn a pre-computed {@code signedAttrs} digest into a raw signature.
 * The desktop agent never sees the document — only the digest — so the entire
 * signing surface is "hash in, signature out", matching {@code CscFifoSigner}.
 *
 * Two RSA strategies, picked by the credential backend:
 *
 *   - {@link #cipher} — apply the RSA private-key operation over
 *     {@code DigestInfo(digest)} via {@code Cipher RSA/ECB/PKCS1Padding}.
 *     Works for A1 keystores and most PKCS#11 tokens (raw RSA / CKM_RSA_PKCS).
 *   - {@link #noneWithRsa} — sign {@code DigestInfo(digest)} via
 *     {@code Signature NONEwithRSA}. Used for the Windows certificate store
 *     (SunMSCAPI), whose non-extractable keys reject the raw cipher path.
 *
 * Both produce the identical RSASSA-PKCS1-v1_5 signature value libpdf verifies.
 */
interface RawDigestSigner {
  byte[] sign(byte[] digest, String digestAlgo) throws Exception;

  default String signatureAlgorithm() {
    return "RSASSA-PKCS1-v1_5";
  }

  static void assertRsa(PrivateKey key) {
    if (!"RSA".equalsIgnoreCase(key.getAlgorithm())) {
      throw new IllegalArgumentException("Unsupported key algorithm: " + key.getAlgorithm() + " (only RSA in Fase 1)");
    }
  }

  /** A1 / PKCS#11 path: RSA private-key op over DigestInfo via Cipher. */
  static RawDigestSigner cipher(PrivateKey key, Provider provider) {
    assertRsa(key);
    return (digest, digestAlgo) -> {
      Cipher c = provider == null
          ? Cipher.getInstance("RSA/ECB/PKCS1Padding")
          : Cipher.getInstance("RSA/ECB/PKCS1Padding", provider);
      c.init(Cipher.ENCRYPT_MODE, key);
      return c.doFinal(DigestInfo.wrap(digestAlgo, digest));
    };
  }

  /**
   * Windows-MY path: sign the RAW digest via NONEwithRSA.
   *
   * SunMSCAPI's {@code NONEwithRSA} is not a generic "sign these bytes verbatim"
   * primitive: it takes the bare hash, infers the digest algorithm from its
   * length (20/32/48/64 → SHA-1/256/384/512) and builds the {@code DigestInfo}
   * plus PKCS#1 v1.5 padding itself inside CryptoAPI. Handing it an already
   * wrapped {@code DigestInfo} makes it see an unrecognised length and fail with
   * "Message digest length is not supported", so we must pass {@code digest}
   * straight through — NOT {@link DigestInfo#wrap}. The resulting signature is
   * the identical RSASSA-PKCS1-v1_5 value the cipher path produces.
   */
  static RawDigestSigner noneWithRsa(PrivateKey key, Provider provider) {
    assertRsa(key);
    return (digest, digestAlgo) -> {
      // Reject digests we don't support up front, so an unknown algo fails the
      // same way the cipher path does instead of producing a wrong signature.
      DigestInfo.jcaName(digestAlgo);
      Signature s = provider == null
          ? Signature.getInstance("NONEwithRSA")
          : Signature.getInstance("NONEwithRSA", provider);
      s.initSign(key);
      s.update(digest);
      return s.sign();
    };
  }
}
