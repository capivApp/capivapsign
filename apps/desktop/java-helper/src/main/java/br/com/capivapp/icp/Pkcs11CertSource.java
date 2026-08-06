package br.com.capivapp.icp;

import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.Provider;
import java.security.Security;

/**
 * A3 token / smartcard source via SunPKCS11.
 *
 * Configures the SunPKCS11 provider against the manufacturer's PKCS#11 module
 * (a {@code .dll} on Windows, {@code .so} on Linux) and opens it as a
 * {@code PKCS11} keystore unlocked with the user's PIN. The private key stays
 * on the token — signing happens on-device through the provider's cipher.
 *
 * Validate on a Windows box with the real token + module path; this environment
 * has no token, so only the construction path is exercised here.
 */
final class Pkcs11CertSource extends KeyStoreCertSource {
  private final Provider provider;

  private Pkcs11CertSource(KeyStore keyStore, char[] pin, Provider provider) {
    super(keyStore, pin);
    this.provider = provider;
  }

  static Pkcs11CertSource open(String modulePath, Integer slot, String pin) throws Exception {
    Provider base = Security.getProvider("SunPKCS11");
    if (base == null) {
      throw new IllegalStateException("SunPKCS11 provider is not available in this JRE.");
    }

    // Inline config (the leading "--" tells configure() the arg is config text,
    // not a file path). One module = one provider instance.
    StringBuilder config = new StringBuilder("--name=icp-").append(Math.abs(modulePath.hashCode()));
    config.append("\nlibrary=").append(modulePath);
    if (slot != null) {
      config.append("\nslot=").append(slot);
    }

    Provider provider = base.configure(config.toString());
    Security.addProvider(provider);

    KeyStore keyStore = KeyStore.getInstance("PKCS11", provider);
    char[] pinChars = pin == null ? null : pin.toCharArray();
    keyStore.load(null, pinChars);

    return new Pkcs11CertSource(keyStore, pinChars, provider);
  }

  @Override
  protected String certType() {
    return "A3";
  }

  @Override
  protected RawDigestSigner signerFor(PrivateKey key) {
    return RawDigestSigner.cipher(key, provider);
  }
}
