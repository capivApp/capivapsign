package br.com.capivapp.icp;

import java.util.Map;
import java.util.HexFormat;

/**
 * DER-encoded {@code DigestInfo} prefixes (RFC 8017 §9.2 / PKCS#1 v1.5).
 *
 * For an RSASSA-PKCS1-v1_5 signature over a pre-computed hash, the encoded
 * message is {@code DigestInfo ::= SEQUENCE { digestAlgorithm, OCTET STRING
 * digest }}. We prepend the algorithm-specific prefix to the raw digest, then
 * apply the RSA private-key operation with PKCS#1 v1.5 type-1 padding.
 *
 * This is exactly what {@code CscFifoSigner} expects libpdf to embed: the
 * signature value over the {@code signedAttrs} digest that {@code
 * CscCaptureSigner} captured.
 */
final class DigestInfo {
  private DigestInfo() {}

  private static final Map<String, byte[]> PREFIXES = Map.of(
      "SHA-256", hex("3031300d060960864801650304020105000420"),
      "SHA-384", hex("3041300d060960864801650304020205000430"),
      "SHA-512", hex("3051300d060960864801650304020305000440"));

  /** Builds {@code DigestInfo} for {@code digestAlgo} wrapping {@code digest}. */
  static byte[] wrap(String digestAlgo, byte[] digest) {
    byte[] prefix = PREFIXES.get(digestAlgo);
    if (prefix == null) {
      throw new IllegalArgumentException("Unsupported digest algorithm: " + digestAlgo);
    }
    byte[] out = new byte[prefix.length + digest.length];
    System.arraycopy(prefix, 0, out, 0, prefix.length);
    System.arraycopy(digest, 0, out, prefix.length, digest.length);
    return out;
  }

  /** Maps our digest-algorithm token to the JCA {@code MessageDigest} name. */
  static String jcaName(String digestAlgo) {
    return switch (digestAlgo) {
      case "SHA-256" -> "SHA-256";
      case "SHA-384" -> "SHA-384";
      case "SHA-512" -> "SHA-512";
      default -> throw new IllegalArgumentException("Unsupported digest algorithm: " + digestAlgo);
    };
  }

  private static byte[] hex(String s) {
    return HexFormat.of().parseHex(s);
  }
}
