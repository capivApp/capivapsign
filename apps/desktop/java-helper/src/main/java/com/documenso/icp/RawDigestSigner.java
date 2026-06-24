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

  /** Windows-MY path: sign DigestInfo via NONEwithRSA (no internal hashing). */
  static RawDigestSigner noneWithRsa(PrivateKey key, Provider provider) {
    assertRsa(key);
    return (digest, digestAlgo) -> {
      Signature s = provider == null
          ? Signature.getInstance("NONEwithRSA")
          : Signature.getInstance("NONEwithRSA", provider);
      s.initSign(key);
      s.update(DigestInfo.wrap(digestAlgo, digest));
      return s.sign();
    };
  }
}
