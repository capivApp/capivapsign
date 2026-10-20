package br.com.capivapp.icp;

import java.util.ArrayList;
import java.util.List;

/**
 * Plain-JDK test runner for {@link AllowedOrigins} (the project has no JUnit:
 * it builds with javac only). Run via {@code ./test.sh}; exits non-zero on any
 * failure.
 */
public final class AllowedOriginsTest {
  private static final String DEFAULT = AllowedOrigins.DEFAULT_PATTERNS;
  private static final List<String> failures = new ArrayList<>();
  private static int passed = 0;

  private AllowedOriginsTest() {}

  public static void main(String[] args) {
    // Default pattern: any capivapp.com.br subdomain over https.
    expectAllowed(DEFAULT, "https://assina.capivapp.com.br");
    expectAllowed(DEFAULT, "https://app.capivapp.com.br");
    expectAllowed(DEFAULT, "https://stg-app.capivapp.com.br");
    expectAllowed(DEFAULT, "https://capivapp.com.br");
    expectAllowed(DEFAULT, "https://ASSINA.CapivApp.com.br");
    expectAllowed(DEFAULT, "https://assina.capivapp.com.br/");
    expectAllowed(DEFAULT, "https://assina.capivapp.com.br:443");
    expectAllowed(DEFAULT, "https://a.b.capivapp.com.br");

    // Bypass attempts against the default pattern.
    expectRefused(DEFAULT, "https://assina.capivapp.com.br.evil.com");
    expectRefused(DEFAULT, "https://evilcapivapp.com.br");
    expectRefused(DEFAULT, "https://capivapp.com.br.evil.com");
    expectRefused(DEFAULT, "https://assina.capivapp.com.br@evil.com");
    expectRefused(DEFAULT, "https://evil.com@assina.capivapp.com.br");
    expectRefused(DEFAULT, "https://user:pass@assina.capivapp.com.br");
    expectRefused(DEFAULT, "https://evil.com#.capivapp.com.br");
    expectRefused(DEFAULT, "https://evil.com?x=.capivapp.com.br");
    expectRefused(DEFAULT, "https://evil.com/.capivapp.com.br");
    expectRefused(DEFAULT, "https://evil.com\\@assina.capivapp.com.br");
    expectRefused(DEFAULT, "https://assina.capivapp.com.br.");
    expectRefused(DEFAULT, "http://assina.capivapp.com.br");
    expectRefused(DEFAULT, "https://assina.capivapp.com.br:8443");
    expectRefused(DEFAULT, "ftp://assina.capivapp.com.br");
    expectRefused(DEFAULT, "assina.capivapp.com.br");
    expectRefused(DEFAULT, "");
    expectRefused(DEFAULT, null);

    // Exact origins: scheme + host + port must match exactly.
    expectAllowed("https://assina.capivapp.com.br", "https://assina.capivapp.com.br");
    expectRefused("https://assina.capivapp.com.br", "https://app.capivapp.com.br");
    expectRefused("https://assina.capivapp.com.br", "https://assina.capivapp.com.br.evil.com");
    expectAllowed("http://localhost:3000", "http://localhost:3000");
    expectRefused("http://localhost:3000", "http://localhost:3001");
    expectRefused("http://localhost:3000", "https://localhost:3000");

    // Comma-separated list mixing wildcard and exact entries.
    String list = "https://*.capivapp.com.br, http://localhost:3000";
    expectAllowed(list, "https://assina.capivapp.com.br");
    expectAllowed(list, "http://localhost:3000");
    expectRefused(list, "http://localhost:3001");

    // Unset / blank configuration falls back to the default, never "allow all".
    expectAllowed(null, "https://assina.capivapp.com.br");
    expectAllowed("  ", "https://assina.capivapp.com.br");
    expectRefused(null, "https://evil.com");

    // A malformed pattern never widens the allow list.
    expectRefused("*", "https://evil.com");
    expectRefused("https://*", "https://evil.com");
    expectRefused("https://*.", "https://evil.com");

    System.out.println("AllowedOriginsTest: " + passed + " passed, " + failures.size() + " failed");
    failures.forEach((failure) -> System.out.println("  FAIL " + failure));
    if (!failures.isEmpty()) {
      System.exit(1);
    }
  }

  private static void expectAllowed(String patterns, String baseUrl) {
    check(patterns, baseUrl, true);
  }

  private static void expectRefused(String patterns, String baseUrl) {
    check(patterns, baseUrl, false);
  }

  private static void check(String patterns, String baseUrl, boolean expected) {
    boolean actual = AllowedOrigins.isAllowed(patterns, baseUrl);
    if (actual == expected) {
      passed++;
      return;
    }
    failures.add("patterns=" + patterns + " baseUrl=" + baseUrl + " expected " + (expected ? "allowed" : "refused"));
  }
}
