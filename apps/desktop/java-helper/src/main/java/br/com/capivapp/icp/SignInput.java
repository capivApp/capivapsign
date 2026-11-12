package br.com.capivapp.icp;

import java.security.MessageDigest;

/**
 * What the server asks the agent to sign for one envelope item: the
 * {@code signedAttrs} digest and, when the server sends them, the DER
 * {@code signedAttrs} bytes themselves. They carry only the document hash, the
 * signing time and the certificate reference, never the document.
 *
 * The bytes are what a hashing {@code SHA256withRSA} needs. The Windows store
 * can only produce a standard signature that way (see
 * {@link RawDigestSigner#jcaSignature}).
 */
record SignInput(byte[] digest, byte[] signedAttrs, String digestAlgo) {

  /**
   * Builds the input, refusing {@code signedAttrs} whose hash is not
   * {@code digest}: signing them would sign something other than what the
   * server pinned.
   */
  static SignInput of(byte[] digest, byte[] signedAttrs, String digestAlgo) throws Exception {
    String jcaName = DigestInfo.jcaName(digestAlgo);
    if (signedAttrs != null && !MessageDigest.isEqual(digest, MessageDigest.getInstance(jcaName).digest(signedAttrs))) {
      throw new IllegalArgumentException("signedAttrs do not match the digest sent by the server");
    }
    return new SignInput(digest, signedAttrs, digestAlgo);
  }

  boolean hasSignedAttrs() {
    return signedAttrs != null;
  }
}
