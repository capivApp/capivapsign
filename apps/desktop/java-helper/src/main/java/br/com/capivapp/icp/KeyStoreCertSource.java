package br.com.capivapp.icp;

import java.security.Key;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.Certificate;
import java.security.cert.X509Certificate;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Base {@link CertSource} over a JCA {@link KeyStore}. A1 (PKCS#12), A3 PKCS#11
 * tokens and the Windows store all surface as keystores — they differ only in
 * how the keystore is opened and which {@link RawDigestSigner} strategy fits
 * the key, so subclasses implement just those two hooks.
 */
abstract class KeyStoreCertSource implements CertSource {
  protected final KeyStore keyStore;
  /** Password (A1) / PIN (A3 token). Null for the Windows store. */
  protected final char[] auth;

  protected KeyStoreCertSource(KeyStore keyStore, char[] auth) {
    this.keyStore = keyStore;
    this.auth = auth;
  }

  /** Hardware tier reported in `list` / persisted as evidence. */
  protected abstract String certType();

  /** The signing strategy appropriate for this backend's keys. */
  protected abstract RawDigestSigner signerFor(PrivateKey key);

  @Override
  public List<Map<String, Object>> list() throws Exception {
    List<Map<String, Object>> out = new ArrayList<>();
    for (String alias : Collections.list(keyStore.aliases())) {
      if (!keyStore.isKeyEntry(alias)) {
        continue;
      }
      Certificate cert = keyStore.getCertificate(alias);
      if (cert instanceof X509Certificate x509) {
        Map<String, Object> info = IcpCert.describe(alias, x509);
        info.put("type", certType());
        // Full leaf-first chain — the server's prepare step needs it to embed.
        info.put("certChainB64", CertUtil.encodeChain(keyStore.getCertificateChain(alias)));
        out.add(info);
      }
    }
    return out;
  }

  @Override
  public Map<String, Object> sign(String alias, byte[] digest, String digestAlgo) throws Exception {
    String resolved = resolveAlias(alias);
    Key key = keyStore.getKey(resolved, auth);
    if (!(key instanceof PrivateKey privateKey)) {
      throw new IllegalArgumentException("Alias '" + resolved + "' has no private key");
    }

    RawDigestSigner signer = signerFor(privateKey);
    byte[] signature = signer.sign(digest, digestAlgo);

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("signatureB64", Base64.getEncoder().encodeToString(signature));
    result.put("signatureAlgorithm", signer.signatureAlgorithm());
    result.put("certChainB64", CertUtil.encodeChain(keyStore.getCertificateChain(resolved)));
    return result;
  }

  /** Allow callers to omit the alias when the keystore holds a single key. */
  protected String resolveAlias(String alias) throws Exception {
    if (alias != null && !alias.isBlank()) {
      return alias;
    }
    List<String> keyAliases = new ArrayList<>();
    for (String candidate : Collections.list(keyStore.aliases())) {
      if (keyStore.isKeyEntry(candidate)) {
        keyAliases.add(candidate);
      }
    }
    if (keyAliases.size() != 1) {
      throw new IllegalArgumentException("Alias is required: keystore holds " + keyAliases.size() + " key entries");
    }
    return keyAliases.get(0);
  }
}
