package br.com.capivapp.icp;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * ICP-Brasil desktop crypto helper — entry point.
 *
 * Scope is deliberately tiny: it lists signing certificates and signs ONE
 * digest. No PDF, no DSS, no timestamp — all of that stays in the server-side
 * libpdf pipeline. The process speaks newline-delimited JSON (NDJSON) over
 * stdin/stdout so the Tauri Rust core can spawn it once and stream requests
 * across a signing session over a loopback pipe (never the network).
 *
 * Protocol (one JSON object per line, request -> response):
 *   -> {"cmd":"list","source":{"type":"P12","path":"...","password":"..."}}
 *   <- {"ok":true,"certs":[{alias,subject,commonName,cpfCnpj,issuer,notAfter,type}]}
 *
 *   -> {"cmd":"sign","source":{...},"alias":"...","digestB64":"...","digestAlgo":"SHA-256"}
 *   <- {"ok":true,"signatureB64":"...","signatureAlgorithm":"RSASSA-PKCS1-v1_5","certChainB64":[...]}
 *
 *   <- {"ok":false,"error":"..."}   on any failure
 */
public final class Main {
  private Main() {}

  @FunctionalInterface
  private interface Command {
    Map<String, Object> run(Map<String, Object> request) throws Exception;
  }

  // Strategy map — dispatch by "cmd", no if/else ladder.
  private static final Map<String, Command> COMMANDS = Map.of(
      "list", Main::handleList,
      "sign", Main::handleSign);

  public static void main(String[] args) throws Exception {
    Log.install();

    // With args -> standalone agent (CLI / protocol-handler) mode.
    // Without args -> NDJSON loop, driven programmatically over stdin/stdout.
    if (args.length > 0) {
      try {
        CliAgent.run(args);
      } catch (Exception e) {
        String message = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
        System.err.println("ERROR: " + message);
        e.printStackTrace();
        System.out.println(Json.write(error(message)));
        // A windowed (console-less) launch has no stdout anyone can read, so the
        // failure has to be shown as a dialog or it is invisible to the signer.
        Feedback.failure("Falha ao assinar:\n" + message);
        System.exit(1);
      }
      return;
    }

    PrintStream out = new PrintStream(System.out, true, StandardCharsets.UTF_8);
    try (BufferedReader reader = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8))) {
      String line;
      while ((line = reader.readLine()) != null) {
        if (line.isBlank()) {
          continue;
        }
        out.println(Json.write(dispatch(line)));
      }
    }
  }

  private static Map<String, Object> dispatch(String line) {
    try {
      Map<String, Object> request = Json.asObject(Json.parse(line));
      String cmd = Json.str(request, "cmd");
      Command command = COMMANDS.get(cmd);
      if (command == null) {
        return error("Unknown command: " + cmd);
      }
      Map<String, Object> response = command.run(request);
      response.put("ok", Boolean.TRUE);
      return response;
    } catch (Exception e) {
      return error(e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage());
    }
  }

  private static Map<String, Object> handleList(Map<String, Object> request) throws Exception {
    try (CertSource source = CertSourceFactory.from(Json.asObject(request.get("source")))) {
      Map<String, Object> response = new LinkedHashMap<>();
      response.put("certs", source.list());
      return response;
    }
  }

  private static Map<String, Object> handleSign(Map<String, Object> request) throws Exception {
    String digestB64 = Json.str(request, "digestB64");
    if (digestB64 == null) {
      throw new IllegalArgumentException("Missing 'digestB64'");
    }
    String digestAlgo = orDefault(Json.str(request, "digestAlgo"), "SHA-256");
    byte[] digest = Base64.getDecoder().decode(digestB64);

    try (CertSource source = CertSourceFactory.from(Json.asObject(request.get("source")))) {
      return source.sign(Json.str(request, "alias"), digest, digestAlgo);
    }
  }

  private static String orDefault(String value, String fallback) {
    return value == null || value.isBlank() ? fallback : value;
  }

  private static Map<String, Object> error(String message) {
    Map<String, Object> response = new LinkedHashMap<>();
    response.put("ok", Boolean.FALSE);
    response.put("error", message);
    return response;
  }
}
