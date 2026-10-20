package br.com.capivapp.icp;

import java.util.ArrayList;
import java.util.List;

/**
 * Plain-JDK test runner for {@link OwnerWindow}, the single owner window every
 * signing dialog (ours and the Windows CSP PIN prompt) is parented to. Uses a
 * fake peer, so it runs without a desktop. Run via {@code ./test.sh}.
 */
public final class OwnerWindowTest {
  private static final List<String> failures = new ArrayList<>();
  private static int passed = 0;

  private OwnerWindowTest() {}

  /** Records every native-side action instead of touching a real window. */
  private static final class FakePeer implements OwnerWindow.Peer<String> {
    final List<String> events = new ArrayList<>();
    int created = 0;

    @Override
    public String create() {
      created++;
      events.add("create");
      return "window-" + created;
    }

    @Override
    public void show(String window) {
      events.add("show " + window);
    }

    @Override
    public void hide(String window) {
      events.add("hide " + window);
    }
  }

  public static void main(String[] args) throws Exception {
    createsTheWindowLazilyAndOnlyOnce();
    keepsTheSameWindowAcrossSessionsSoAnHwndNeverGoesStale();
    hidesOnlyWhenTheLastConcurrentSessionCloses();
    closingASessionTwiceIsHarmless();

    System.out.println("OwnerWindowTest: " + passed + " passed, " + failures.size() + " failed");
    failures.forEach((failure) -> System.out.println("  FAIL " + failure));
    if (!failures.isEmpty()) {
      System.exit(1);
    }
  }

  private static void createsTheWindowLazilyAndOnlyOnce() throws Exception {
    FakePeer peer = new FakePeer();
    OwnerWindow<String> owner = new OwnerWindow<>(peer);

    expect("no window before the first session", peer.created == 0);

    try (Ui.Session session = owner.acquire()) {
      expect("window created on first session", peer.created == 1);
      expect("window is shown while a session is open", peer.events.contains("show window-1"));
      expect("current window exposed to dialogs", "window-1".equals(owner.window()));
    }
  }

  private static void keepsTheSameWindowAcrossSessionsSoAnHwndNeverGoesStale() throws Exception {
    FakePeer peer = new FakePeer();
    OwnerWindow<String> owner = new OwnerWindow<>(peer);

    try (Ui.Session first = owner.acquire()) {
      // first signing request
    }
    try (Ui.Session second = owner.acquire()) {
      expect("second session reuses the first window", "window-1".equals(owner.window()));
    }

    expect("window created exactly once across sessions", peer.created == 1);
    expect("sessions show and hide, never recreate",
        List.of("create", "show window-1", "hide window-1", "show window-1", "hide window-1").equals(peer.events));
  }

  private static void hidesOnlyWhenTheLastConcurrentSessionCloses() throws Exception {
    FakePeer peer = new FakePeer();
    OwnerWindow<String> owner = new OwnerWindow<>(peer);

    Ui.Session first = owner.acquire();
    Ui.Session second = owner.acquire();
    first.close();
    expect("still visible while another request is signing", !peer.events.contains("hide window-1"));

    second.close();
    expect("hidden after the last session", peer.events.get(peer.events.size() - 1).equals("hide window-1"));
  }

  private static void closingASessionTwiceIsHarmless() throws Exception {
    FakePeer peer = new FakePeer();
    OwnerWindow<String> owner = new OwnerWindow<>(peer);

    Ui.Session other = owner.acquire();
    Ui.Session session = owner.acquire();
    session.close();
    session.close();
    expect("a double close does not release another session's hold", !peer.events.contains("hide window-1"));

    other.close();
    expect("hidden once every session closed", peer.events.contains("hide window-1"));
  }

  private static void expect(String description, boolean condition) {
    if (condition) {
      passed++;
      return;
    }
    failures.add(description);
  }
}
