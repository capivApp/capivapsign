package com.documenso.icp;

import java.net.URI;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Standalone agent entrypoint — the "no desktop app" path.
 *
 * Invoked from the command line (testing) or as a registered protocol handler
 * (production: {@code documenso-icp://sign?...}). It performs the WHOLE remote
 * flow with the recipient's local certificate, never downloading the document:
 *
 *   select cert (A1/A3) -> POST prepare (send chain, get digests)
 *     -> sign each digest locally -> POST complete (send signatures)
 *
 * Documenso's `complete` then runs the usual server-side notifications, so
 * there is no separate "callback URL" — `complete` is the callback.
 *
 * Usage:
 *   sign  --base-url URL --token RECIPIENT_TOKEN --source p12|pkcs11|windows-my [backend opts] [--alias A]
 *   list  --source p12|pkcs11|windows-my [backend opts]
 *   "documenso-icp://sign?baseUrl=URL&token=RECIPIENT_TOKEN&source=windows-my[&...]"
 *
 * Backend opts: --p12 PATH [--password P] | --module DLL [--slot N] [--pin P] | (windows-my needs none)
 * Secrets omitted on the command line are prompted interactively (and SHOULD be,
 * for protocol-handler launches — never put a password/PIN in a deep link).
 */
final class CliAgent {
  private CliAgent() {}

  static void run(String[] args) throws Exception {
    if (args[0].startsWith("documenso-icp://")) {
      runSign(parseUri(args[0]));
      return;
    }

    String command = args[0];
    Map<String, String> opts = parseFlags(args, 1);

    switch (command) {
      case "sign" -> runSign(opts);
      case "list" -> runList(opts);
      default -> throw new IllegalArgumentException("Unknown command '" + command + "'. Use: sign | list");
    }
  }

  // ---- commands ------------------------------------------------------------

  private static void runList(Map<String, String> opts) throws Exception {
    try (CertSource source = openSource(opts)) {
      List<Map<String, Object>> certs = source.list();
      System.err.println("Certificates (" + certs.size() + "):");
      for (int i = 0; i < certs.size(); i++) {
        Map<String, Object> c = certs.get(i);
        System.err.printf("  [%d] %s — CPF/CNPJ %s — %s — exp %s%n",
            i + 1, c.get("commonName"), c.get("cpfCnpj"), c.get("type"), c.get("notAfter"));
      }
      System.out.println(Json.write(Map.of("ok", true, "certs", certs)));
    }
  }

  @SuppressWarnings("unchecked")
  private static void runSign(Map<String, String> opts) throws Exception {
    String baseUrl = requireOpt(opts, "base-url");
    String recipientToken = requireOpt(opts, "token");
    assertAllowedOrigin(baseUrl);

    try (CertSource source = openSource(opts)) {
      List<Map<String, Object>> certs = source.list();
      if (certs.isEmpty()) {
        throw new IllegalStateException("No signing certificates found for the selected source.");
      }

      Map<String, Object> chosen = selectCert(certs, opts.get("alias"));
      String alias = String.valueOf(chosen.get("alias"));
      List<Object> certChainB64 = (List<Object>) chosen.get("certChainB64");
      String certType = String.valueOf(chosen.get("type"));

      System.err.printf("Signing as %s (CPF/CNPJ %s) against %s%n",
          chosen.get("commonName"), chosen.get("cpfCnpj"), baseUrl);

      DocumensoClient client = new DocumensoClient(baseUrl, opts.get("bearer"));

      Map<String, Object> prepared = client.prepare(recipientToken, certChainB64, certType);
      String sessionId = String.valueOf(prepared.get("sessionId"));
      List<Object> items = (List<Object>) prepared.get("items");
      Map<String, Object> policy = (Map<String, Object>) prepared.get("policy");
      String digestAlgo = policy == null ? "SHA-256" : String.valueOf(policy.get("digestAlgo"));

      List<Object> signedItems = new ArrayList<>();
      for (Object itemObj : items) {
        Map<String, Object> item = (Map<String, Object>) itemObj;
        byte[] digest = Base64.getDecoder().decode(String.valueOf(item.get("digestB64")));
        Map<String, Object> signed = source.sign(alias, digest, digestAlgo);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("envelopeItemId", item.get("envelopeItemId"));
        out.put("signatureB64", signed.get("signatureB64"));
        signedItems.add(out);
      }

      Map<String, Object> result = client.complete(sessionId, signedItems);
      System.err.println("Outcome: " + result.get("outcome"));
      System.out.println(Json.write(Map.of("ok", true, "outcome", result.getOrDefault("outcome", "signed"))));
    }
  }

  // ---- cert source construction (reuses the NDJSON factory) ----------------

  private static CertSource openSource(Map<String, String> opts) throws Exception {
    String kind = requireOpt(opts, "source").toLowerCase();
    Map<String, Object> descriptor = new LinkedHashMap<>();

    switch (kind) {
      case "p12", "a1" -> {
        descriptor.put("type", "P12");
        descriptor.put("path", requireOpt(opts, "p12"));
        descriptor.put("password", opts.containsKey("password") ? opts.get("password") : Prompt.secret("P12 password: "));
      }
      case "pkcs11", "a3", "token" -> {
        descriptor.put("type", "PKCS11");
        descriptor.put("module", requireOpt(opts, "module"));
        if (opts.containsKey("slot")) {
          descriptor.put("slot", opts.get("slot"));
        }
        descriptor.put("pin", opts.containsKey("pin") ? opts.get("pin") : Prompt.secret("Token PIN: "));
      }
      case "windows-my", "windows", "mscapi" -> descriptor.put("type", "WINDOWS_MY");
      default -> throw new IllegalArgumentException("Unknown --source '" + kind + "'. Use: p12 | pkcs11 | windows-my");
    }

    return CertSourceFactory.from(descriptor);
  }

  private static Map<String, Object> selectCert(List<Map<String, Object>> certs, String alias) throws Exception {
    if (alias != null && !alias.isBlank()) {
      return certs.stream()
          .filter((c) -> alias.equals(c.get("alias")))
          .findFirst()
          .orElseThrow(() -> new IllegalArgumentException("No certificate with alias '" + alias + "'."));
    }

    if (certs.size() == 1) {
      return certs.get(0);
    }

    System.err.println("Select a certificate:");
    for (int i = 0; i < certs.size(); i++) {
      Map<String, Object> c = certs.get(i);
      System.err.printf("  [%d] %s — CPF/CNPJ %s — %s%n", i + 1, c.get("commonName"), c.get("cpfCnpj"), c.get("type"));
    }
    return certs.get(Prompt.selectIndex("Certificate", certs.size()));
  }

  // ---- argument / URI parsing ---------------------------------------------

  private static Map<String, String> parseFlags(String[] args, int from) {
    Map<String, String> opts = new LinkedHashMap<>();
    for (int i = from; i < args.length; i++) {
      String arg = args[i];
      if (!arg.startsWith("--")) {
        throw new IllegalArgumentException("Unexpected argument '" + arg + "'.");
      }
      String key = arg.substring(2);
      // `--flag value` or `--flag` (boolean -> empty string).
      if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
        opts.put(key, args[++i]);
      } else {
        opts.put(key, "");
      }
    }
    return opts;
  }

  private static Map<String, String> parseUri(String uriString) {
    URI uri = URI.create(uriString);
    Map<String, String> opts = new LinkedHashMap<>();
    String query = uri.getRawQuery();
    if (query != null) {
      for (String pair : query.split("&")) {
        int eq = pair.indexOf('=');
        String key = decode(eq < 0 ? pair : pair.substring(0, eq));
        String value = eq < 0 ? "" : decode(pair.substring(eq + 1));
        // Map camelCase query keys to the flag names used internally.
        opts.put("baseUrl".equals(key) ? "base-url" : key, value);
      }
    }
    return opts;
  }

  private static String decode(String s) {
    return java.net.URLDecoder.decode(s, java.nio.charset.StandardCharsets.UTF_8);
  }

  // ---- guards --------------------------------------------------------------

  /**
   * SSRF guard: when {@code ICP_ALLOWED_ORIGIN} is set, the target must live on
   * that origin. A protocol handler is invokable by any web page, so the agent
   * must refuse to talk to arbitrary hosts.
   */
  private static void assertAllowedOrigin(String baseUrl) {
    String allowed = System.getenv("ICP_ALLOWED_ORIGIN");
    if (allowed == null || allowed.isBlank()) {
      System.err.println("WARNING: ICP_ALLOWED_ORIGIN not set — accepting any base URL. Set it in production.");
      return;
    }
    if (!baseUrl.startsWith(allowed)) {
      throw new SecurityException("Refusing base URL outside allowed origin (" + allowed + "): " + baseUrl);
    }
  }

  private static String requireOpt(Map<String, String> opts, String key) {
    String value = opts.get(key);
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException("Missing required --" + key);
    }
    return value;
  }
}
