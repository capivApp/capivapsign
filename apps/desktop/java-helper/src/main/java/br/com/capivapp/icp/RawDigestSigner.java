package br.com.capivapp.icp;

import java.security.PrivateKey;
import java.security.Provider;
import javax.crypto.Cipher;
import java.security.Signature;

/**
 * Strategy: turn one {@link SignInput} (the captured {@code signedAttrs} digest,
 * plus the {@code signedAttrs} bytes when the server sends them) into a raw
 * signature. The desktop agent never sees the document, so the entire signing
 * surface is "signedAttrs in, signature out", matching {@code CscFifoSigner}.
 *
 * Two RSA strategies, picked by the credential backend:
 *
 *   - {@link #cipher}: apply the RSA private-key operation over
 *     {@code DigestInfo(digest)} via {@code Cipher RSA/ECB/PKCS1Padding}.
 *     Works for A1 keystores and most PKCS#11 tokens (raw RSA / CKM_RSA_PKCS).
 *   - {@link #jcaSignature}: hash and sign the {@code signedAttrs} bytes via
 *     {@code SHA256withRSA}. Used for the Windows certificate store
 *     (SunMSCAPI), whose non-extractable keys reject the raw cipher path.
 *
 * Both produce the identical RSASSA-PKCS1-v1_5 signature value libpdf embeds.
 */
interface RawDigestSigner {
  byte[] sign(SignInput input) throws Exception;

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
    return (input) -> {
      Cipher c = provider == null
          ? Cipher.getInstance("RSA/ECB/PKCS1Padding")
          : Cipher.getInstance("RSA/ECB/PKCS1Padding", provider);
      c.init(Cipher.ENCRYPT_MODE, key);
      return c.doFinal(DigestInfo.wrap(input.digestAlgo(), input.digest()));
    };
  }

  /**
   * Windows-MY path: hash and sign the {@code signedAttrs} with a hashing
   * {@code SHA256withRSA}.
   *
   * Signing the pre-computed digest is NOT possible on SunMSCAPI. Its
   * {@code NONEwithRSA} signs with {@code CRYPT_NOHASHOID}: the PKCS#1 block
   * carries the bare hash, with no {@code DigestInfo}, which is not an
   * RSASSA-PKCS1-v1_5 signature (the ITI validator reports "Cifra assimétrica:
   * Reprovada"). Handing it a wrapped {@code DigestInfo} fails its length check
   * ("Message digest length is not supported"). Only the hashing signatures
   * embed the algorithm OID, so this strategy needs the {@code signedAttrs}
   * bytes, and refuses a digest-only request instead of signing it wrong.
   */
  static RawDigestSigner jcaSignature(PrivateKey key, Provider provider) {
    assertRsa(key);
    return (input) -> {
      if (!input.hasSignedAttrs()) {
        throw new IllegalStateException(
            "This certificate store needs the signedAttrs bytes, which the server did not send. Update the CapivaSign server.");
      }
      String algorithm = DigestInfo.jcaRsaSignatureName(input.digestAlgo());
      Signature s = provider == null
          ? Signature.getInstance(algorithm)
          : Signature.getInstance(algorithm, provider);
      s.initSign(key);
      s.update(input.signedAttrs());
      return s.sign();
    };
  }
}
