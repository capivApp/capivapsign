package com.documenso.icp;

import java.nio.file.Path;
import java.util.Map;
import java.util.function.Function;

/**
 * Factory: build the right {@link CertSource} strategy from the request's
 * {@code source} descriptor. New credential backends (PKCS#11 token, Windows
 * MY store) register here without touching call sites.
 */
final class CertSourceFactory {
  private CertSourceFactory() {}

  private static final Map<String, Builder> REGISTRY = Map.of(
      "P12", CertSourceFactory::buildP12,
      "PKCS11", CertSourceFactory::buildPkcs11,
      "WINDOWS_MY", CertSourceFactory::buildWindowsMy);

  interface Builder {
    CertSource build(Map<String, Object> source) throws Exception;
  }

  static CertSource from(Map<String, Object> source) throws Exception {
    if (source == null) {
      throw new IllegalArgumentException("Missing 'source' descriptor");
    }
    String type = Json.str(source, "type");
    Builder builder = REGISTRY.get(type);
    if (builder == null) {
      throw new IllegalArgumentException("Unsupported source type: " + type);
    }
    return builder.build(source);
  }

  private static CertSource buildP12(Map<String, Object> source) throws Exception {
    String path = require(source, "path");
    String password = Json.str(source, "password");
    return P12CertSource.open(Path.of(path), password);
  }

  private static CertSource buildPkcs11(Map<String, Object> source) throws Exception {
    String module = require(source, "module");
    String pin = Json.str(source, "pin");
    String slotStr = Json.str(source, "slot");
    Integer slot = slotStr == null || slotStr.isBlank() ? null : (int) Double.parseDouble(slotStr);
    return Pkcs11CertSource.open(module, slot, pin);
  }

  private static CertSource buildWindowsMy(Map<String, Object> source) throws Exception {
    return WindowsMyCertSource.open();
  }

  private static String require(Map<String, Object> source, String key) {
    return require(source, key, Function.identity());
  }

  private static <T> T require(Map<String, Object> source, String key, Function<String, T> map) {
    String value = Json.str(source, key);
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException("Missing '" + key + "' in source");
    }
    return map.apply(value);
  }
}
