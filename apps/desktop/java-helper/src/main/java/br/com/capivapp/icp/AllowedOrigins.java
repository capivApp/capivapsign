package br.com.capivapp.icp;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * SSRF guard for the agent: which CapivaSign origins it may talk to.
 *
 * A protocol handler and the loopback server are invokable by any web page, so
 * the agent must refuse to send a recipient's certificate chain and signatures
 * to an arbitrary host. The allow list comes from {@code ICP_ALLOWED_ORIGIN}, a
 * comma-separated list of origins; when unset it falls back to
 * {@link #DEFAULT_PATTERNS} (never "allow everything").
 *
 * Each entry is either an exact origin ({@code https://assina.capivapp.com.br},
 * {@code http://localhost:3000}) or a wildcard origin
 * ({@code https://*.capivapp.com.br}), which matches the apex domain and any
 * subdomain of it. Matching is done on the PARSED base URL: same scheme, same
 * effective port, and a host that is equal to (or, for a wildcard, a dot-label
 * suffix of) the entry's host. URLs carrying userinfo, a query or a fragment
 * are refused outright.
 */
final class AllowedOrigins {
  static final String ENV_VAR = "ICP_ALLOWED_ORIGIN";
  static final String DEFAULT_PATTERNS = "https://*.capivapp.com.br";

  private static final String WILDCARD_PREFIX = "*.";
  private static final Map<String, Integer> DEFAULT_PORTS = Map.of("https", 443, "http", 80);

  private record Rule(String scheme, String host, int port, boolean isWildcard) {
    boolean matches(Origin origin) {
      return scheme.equals(origin.scheme()) && port == origin.port() && matchesHost(origin.host());
    }

    private boolean matchesHost(String candidate) {
      return candidate.equals(host) || (isWildcard && candidate.endsWith("." + host));
    }
  }

  private record Origin(String scheme, String host, int port) {}

  private AllowedOrigins() {}

  /** The allow list in effect: {@code ICP_ALLOWED_ORIGIN}, or the default when unset. */
  static String configured() {
    return withDefault(System.getenv(ENV_VAR));
  }

  /** Throws a user-facing {@link SecurityException} when {@code baseUrl} is not allowed. */
  static void assertAllowed(String baseUrl) {
    String patterns = configured();
    if (isAllowed(patterns, baseUrl)) {
      return;
    }
    System.err.println("Refusing base URL outside allowed origins (" + patterns + "): " + baseUrl);
    throw new SecurityException("Este site não está autorizado no assinador: " + baseUrl
        + ". Instale a versão mais recente do assinador CapivaSign.");
  }

  static boolean isAllowed(String patterns, String baseUrl) {
    Optional<Origin> origin = parseOrigin(baseUrl);
    if (origin.isEmpty()) {
      return false;
    }
    return parseRules(withDefault(patterns)).stream().anyMatch((rule) -> rule.matches(origin.get()));
  }

  // ---- parsing ---------------------------------------------------------------

  private static String withDefault(String patterns) {
    return patterns == null || patterns.isBlank() ? DEFAULT_PATTERNS : patterns;
  }

  private static List<Rule> parseRules(String patterns) {
    return Arrays.stream(patterns.split(","))
        .map(String::trim)
        .filter((pattern) -> !pattern.isEmpty())
        .map(AllowedOrigins::parseRule)
        .flatMap(Optional::stream)
        .toList();
  }

  private static Optional<Rule> parseRule(String pattern) {
    int schemeEnd = pattern.indexOf("://");
    if (schemeEnd < 0) {
      return warnInvalid(pattern);
    }
    int hostStart = schemeEnd + 3;
    boolean isWildcard = pattern.startsWith(WILDCARD_PREFIX, hostStart);
    String concrete = isWildcard
        ? pattern.substring(0, hostStart) + pattern.substring(hostStart + WILDCARD_PREFIX.length())
        : pattern;

    Optional<Rule> rule = parseOrigin(concrete)
        .map((origin) -> new Rule(origin.scheme(), origin.host(), origin.port(), isWildcard));
    return rule.isPresent() ? rule : warnInvalid(pattern);
  }

  private static Optional<Rule> warnInvalid(String pattern) {
    System.err.println("WARNING: ignoring invalid " + ENV_VAR + " entry: " + pattern);
    return Optional.empty();
  }

  private static Optional<Origin> parseOrigin(String url) {
    if (url == null || url.isBlank()) {
      return Optional.empty();
    }
    try {
      URI uri = new URI(url.trim());
      return toOrigin(uri);
    } catch (URISyntaxException e) {
      return Optional.empty();
    }
  }

  private static Optional<Origin> toOrigin(URI uri) {
    boolean hasExtras = uri.getRawUserInfo() != null || uri.getRawQuery() != null || uri.getRawFragment() != null;
    if (hasExtras || uri.getScheme() == null || uri.getHost() == null || uri.getHost().isEmpty()) {
      return Optional.empty();
    }
    String scheme = uri.getScheme().toLowerCase(Locale.ROOT);
    Integer defaultPort = DEFAULT_PORTS.get(scheme);
    if (defaultPort == null) {
      return Optional.empty();
    }
    int port = uri.getPort() == -1 ? defaultPort : uri.getPort();
    String host = uri.getHost().toLowerCase(Locale.ROOT);
    return Optional.of(new Origin(scheme, host, port));
  }
}
