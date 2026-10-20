package br.com.capivapp.icp;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Plain-JDK test runner: the signing flow must hold a {@link Ui.Session} (the
 * live owner window) from BEFORE the first prompt / key store access until
 * AFTER the key store is closed, including on failure. Run via {@code ./test.sh}.
 */
public final class SigningSessionTest {
  private static final List<String> failures = new ArrayList<>();
  private static int passed = 0;

  private SigningSessionTest() {}

  /** Records the order of UI interactions; never shows anything. */
  private static final class RecordingUi implements Ui {
    final List<String> events = new ArrayList<>();

    @Override
    public Session openSession() {
      events.add("session-open");
      return () -> events.add("session-close");
    }

    @Override
    public int chooseCertificate(List<Map<String, Object>> certs) {
      events.add("choose");
      return 0;
    }

    @Override
    public String secret(String label) {
      events.add("secret");
      return "senha";
    }

    @Override
    public String pickFile(String label) {
      events.add("pick-file");
      return "/nonexistent/capivasign-test.p12";
    }

    @Override
    public void info(String message) {
      events.add("info");
    }
  }

  public static void main(String[] args) {
    sessionWrapsTheKeyStoreAccessEvenWhenItFails();
    onlyTheServerStaysResident();

    System.out.println("SigningSessionTest: " + passed + " passed, " + failures.size() + " failed");
    failures.forEach((failure) -> System.out.println("  FAIL " + failure));
    if (!failures.isEmpty()) {
      System.exit(1);
    }
  }

  private static void sessionWrapsTheKeyStoreAccessEvenWhenItFails() {
    RecordingUi ui = new RecordingUi();
    // A1 by file: the prompts run, then opening the (missing) file fails.
    Map<String, String> opts = CliAgent.optsFromRequest("https://assina.capivapp.com.br", "token", "p12");

    boolean threw = false;
    try {
      CliAgent.performSign(opts, ui);
    } catch (Exception e) {
      threw = true;
    }

    expect("missing .p12 makes the sign fail", threw);
    expect("session opened before any prompt and closed after the failure, got " + ui.events,
        List.of("session-open", "pick-file", "secret", "session-close").equals(ui.events));
  }

  // The owner window is never disposed, so Main must exit one-shot runs itself.
  private static void onlyTheServerStaysResident() {
    expect("serve stays resident", CliAgent.isResident(new String[] {"serve", "--no-gui"}));
    expect("sign is one-shot", !CliAgent.isResident(new String[] {"sign", "--source", "p12"}));
    expect("list is one-shot", !CliAgent.isResident(new String[] {"list", "--source", "windows-my"}));
    expect("deep link is one-shot", !CliAgent.isResident(new String[] {Brand.PROTOCOL_PREFIX + "sign?token=x"}));
  }

  private static void expect(String description, boolean condition) {
    if (condition) {
      passed++;
      return;
    }
    failures.add(description);
  }
}
