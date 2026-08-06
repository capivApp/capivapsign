package br.com.capivapp.icp;

import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.Provider;
import java.security.Security;

/**
 * A3 source via the Windows certificate store ("MY") through SunMSCAPI.
 *
 * The store is unlocked by the OS (no PIN passed here; CryptoAPI prompts as
 * needed). Keys are non-extractable handles, so signing goes through
 * {@code NONEwithRSA} on the SunMSCAPI provider rather than the raw cipher.
 *
 * Windows-only: SunMSCAPI is absent on other platforms, so this throws at
 * construction off-Windows. Validate on the target Windows box.
 */
final class WindowsMyCertSource extends KeyStoreCertSource {
  private final Provider provider;

  private WindowsMyCertSource(KeyStore keyStore, Provider provider) {
    super(keyStore, null);
    this.provider = provider;
  }

  static WindowsMyCertSource open() throws Exception {
    Provider provider = Security.getProvider("SunMSCAPI");
    if (provider == null) {
      throw new IllegalStateException("SunMSCAPI provider is only available on Windows.");
    }

    KeyStore keyStore = KeyStore.getInstance("Windows-MY", provider);
    keyStore.load(null, null);

    return new WindowsMyCertSource(keyStore, provider);
  }

  @Override
  protected String certType() {
    return "A3";
  }

  @Override
  protected RawDigestSigner signerFor(PrivateKey key) {
    return RawDigestSigner.noneWithRsa(key, provider);
  }
}
