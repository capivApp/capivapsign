package com.documenso.icp;

import java.util.List;
import java.util.Map;

/**
 * Strategy interface over a source of signing certificates + keys.
 *
 * The desktop agent can hold the user's credential in different places:
 *   - A1  -> a {@code .p12}/{@code .pfx} file ({@link P12CertSource})
 *   - A3  -> a PKCS#11 token / smartcard           (future: Pkcs11CertSource)
 *   - A3  -> the Windows certificate store (MY)     (future: WindowsMyCertSource)
 *
 * Every source exposes the same two operations. The PDF / PAdES / DSS / LTA
 * work stays server-side in the libpdf pipeline; this helper's entire job is
 * "list certificates" and "sign one digest".
 */
interface CertSource extends AutoCloseable {
  /** Lists available signing certificates as ICP identity descriptors. */
  List<Map<String, Object>> list() throws Exception;

  /**
   * Signs {@code digest} (the captured {@code signedAttrs} hash) with the key
   * for {@code alias}, returning {@code {signatureB64, certChainB64[],
   * signatureAlgorithm}}.
   */
  Map<String, Object> sign(String alias, byte[] digest, String digestAlgo) throws Exception;

  @Override
  default void close() throws Exception {}
}
