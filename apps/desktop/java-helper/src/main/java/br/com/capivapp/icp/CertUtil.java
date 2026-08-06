package br.com.capivapp.icp;

import java.security.cert.Certificate;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

/** Small shared certificate helpers used by every {@link CertSource}. */
final class CertUtil {
  private CertUtil() {}

  /** Base64-DER encode a leaf-first certificate chain (may be null/empty). */
  static List<Object> encodeChain(Certificate[] chain) throws Exception {
    List<Object> encoded = new ArrayList<>();
    if (chain == null) {
      return encoded;
    }
    Base64.Encoder encoder = Base64.getEncoder();
    for (Certificate cert : chain) {
      encoded.add(encoder.encodeToString(cert.getEncoded()));
    }
    return encoded;
  }
}
