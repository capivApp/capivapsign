package com.documenso.icp;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyStore;
import java.security.PrivateKey;

/**
 * A1 credential source: a PKCS#12 ({@code .p12}/{@code .pfx}) keystore read from
 * a local file. The key never leaves this process — it is loaded, used to sign
 * a single digest, and discarded. Signing uses the raw RSA cipher path.
 */
final class P12CertSource extends KeyStoreCertSource {
  private P12CertSource(KeyStore keyStore, char[] password) {
    super(keyStore, password);
  }

  static P12CertSource open(Path path, String password) throws Exception {
    KeyStore keyStore = KeyStore.getInstance("PKCS12");
    char[] pass = password == null ? new char[0] : password.toCharArray();
    try (InputStream in = Files.newInputStream(path)) {
      keyStore.load(in, pass);
    }
    return new P12CertSource(keyStore, pass);
  }

  @Override
  protected String certType() {
    return "A1";
  }

  @Override
  protected RawDigestSigner signerFor(PrivateKey key) {
    return RawDigestSigner.cipher(key, null);
  }
}
