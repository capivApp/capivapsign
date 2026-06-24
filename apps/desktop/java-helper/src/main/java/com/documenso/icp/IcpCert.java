package com.documenso.icp;

import java.security.cert.X509Certificate;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Reads the ICP-Brasil-relevant identity out of an X.509 certificate.
 *
 * The CPF (pessoa física) / CNPJ (pessoa jurídica) live in the certificate's
 * subjectAlternativeName as an {@code otherName} under ICP-Brasil OIDs:
 *   - 2.16.76.1.3.1  dadosPessoaFisica (contains DOB + CPF + RG ...)
 *   - 2.16.76.1.3.3  cnpj (pessoa jurídica)
 * The structured PF field is a fixed-width string whose CPF is the 11 digits
 * after the 8-digit date of birth. We pull the digits out of the otherName
 * value and, when no ICP SAN is present (e.g. plain test certificates), fall
 * back to the {@code CN=NAME:CPF} convention used by the spike fixtures.
 *
 * Full structured DER decoding of every ICP attribute is a Fase 5 refinement;
 * for signing we only need a stable identifier to persist as evidence.
 */
final class IcpCert {
  private IcpCert() {}

  private static final String OID_PF = "2.16.76.1.3.1";
  private static final String OID_CNPJ = "2.16.76.1.3.3";
  private static final Pattern CN_CPF = Pattern.compile(":(\\d{11,14})\\b");
  private static final Pattern DIGITS = Pattern.compile("\\d{11,14}");

  static Map<String, Object> describe(String alias, X509Certificate cert) throws Exception {
    Map<String, Object> info = new LinkedHashMap<>();
    info.put("alias", alias);
    info.put("subject", cert.getSubjectX500Principal().getName());
    info.put("issuer", cert.getIssuerX500Principal().getName());
    info.put("commonName", commonName(cert));
    info.put("cpfCnpj", cpfCnpj(cert));
    info.put("serial", cert.getSerialNumber().toString(16));
    info.put("notAfter", cert.getNotAfter().toInstant().toString());
    info.put("keyType", cert.getPublicKey().getAlgorithm());
    // Leaf cert DER — the server's prepare/capture step hashes this exact
    // certificate into the ESS signingCertificate attribute, so it must use the
    // same bytes the embed pass will carry.
    info.put("certB64", java.util.Base64.getEncoder().encodeToString(cert.getEncoded()));
    return info;
  }

  static String commonName(X509Certificate cert) {
    String dn = cert.getSubjectX500Principal().getName();
    Matcher m = Pattern.compile("CN=([^,]+)").matcher(dn);
    if (!m.find()) {
      return dn;
    }
    String cn = m.group(1).trim();
    int sep = cn.indexOf(':');
    return sep > 0 ? cn.substring(0, sep).trim() : cn;
  }

  static String cpfCnpj(X509Certificate cert) {
    String fromSan = fromSubjectAltName(cert);
    if (fromSan != null) {
      return fromSan;
    }
    Matcher m = CN_CPF.matcher(cert.getSubjectX500Principal().getName());
    return m.find() ? m.group(1) : null;
  }

  private static String fromSubjectAltName(X509Certificate cert) {
    try {
      Collection<List<?>> names = cert.getSubjectAlternativeNames();
      if (names == null) {
        return null;
      }
      for (List<?> entry : names) {
        // otherName has tag 0; value is the DER-encoded OtherName bytes.
        if (((Number) entry.get(0)).intValue() != 0) {
          continue;
        }
        Object value = entry.get(1);
        String text = value instanceof byte[] bytes ? new String(bytes, java.nio.charset.StandardCharsets.ISO_8859_1)
            : String.valueOf(value);
        if (text.contains(OID_PF) || text.contains(OID_CNPJ)) {
          Matcher m = DIGITS.matcher(text);
          if (m.find()) {
            return m.group();
          }
        }
      }
    } catch (Exception ignored) {
      // Malformed SAN — fall back to the CN convention.
    }
    return null;
  }
}
