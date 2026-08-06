package br.com.capivapp.icp;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Thin HTTP client for the CapivaSign ICP signing API. The agent only ever
 * touches two endpoints — it never downloads the document, only exchanges
 * digests for signatures:
 *
 *   POST {baseUrl}/api/icp/sign/prepare   -> { sessionId, items:[{envelopeItemId,digestB64}], policy }
 *   POST {baseUrl}/api/icp/sign/complete  -> { outcome }
 *
 * The recipient token is the capability that authorises the flow (same trust as
 * the signing link); an optional bearer token is forwarded when the instance
 * additionally requires a paired-device token.
 */
final class CapivaSignClient {
  private final String baseUrl;
  private final String bearerToken;
  private final HttpClient http;

  CapivaSignClient(String baseUrl, String bearerToken) {
    this.baseUrl = baseUrl.replaceAll("/+$", "");
    this.bearerToken = bearerToken;
    // Force HTTP/1.1. The default (HTTP_2) attempts an h2c upgrade over plain
    // `http://`, which Node servers (Hono/@hono/node-server) don't support — the
    // TCP connects but the exchange hangs until the request timeout. The browser
    // and curl/Postman work precisely because they speak HTTP/1.1.
    this.http = HttpClient.newBuilder()
        .version(HttpClient.Version.HTTP_1_1)
        .connectTimeout(Duration.ofSeconds(20))
        .build();
  }

  Map<String, Object> prepare(String recipientToken, List<Object> certChainB64, String certType) throws Exception {
    return post("/api/icp/sign/prepare", Map.of(
        "recipientToken", recipientToken,
        "certChainB64", certChainB64,
        "certType", certType));
  }

  Map<String, Object> complete(String sessionId, List<Object> items) throws Exception {
    return post("/api/icp/sign/complete", Map.of(
        "sessionId", sessionId,
        "items", items));
  }

  private Map<String, Object> post(String path, Map<String, Object> body) throws Exception {
    HttpRequest.Builder req = HttpRequest.newBuilder()
        .uri(URI.create(baseUrl + path))
        .timeout(Duration.ofSeconds(60))
        .header("content-type", "application/json")
        .header("accept", "application/json")
        .POST(HttpRequest.BodyPublishers.ofString(Json.write(body)));

    if (bearerToken != null && !bearerToken.isBlank()) {
      req.header("authorization", "Bearer " + bearerToken);
    }

    HttpResponse<String> res = http.send(req.build(), HttpResponse.BodyHandlers.ofString());

    if (res.statusCode() < 200 || res.statusCode() >= 300) {
      throw new IllegalStateException("POST " + path + " -> HTTP " + res.statusCode() + ": " + res.body());
    }

    return Json.asObject(Json.parse(res.body()));
  }
}
