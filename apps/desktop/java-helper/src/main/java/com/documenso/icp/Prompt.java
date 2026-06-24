package com.documenso.icp;

import java.io.BufferedReader;
import java.io.Console;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

/**
 * Minimal interactive console prompts for the standalone agent: a line, a
 * masked secret (password / PIN), and a numbered selection. Uses {@link Console}
 * when attached (masks secrets) and falls back to stdin otherwise so the agent
 * still works when launched from a protocol handler without a real console.
 */
final class Prompt {
  private Prompt() {}

  private static final Console CONSOLE = System.console();
  private static final BufferedReader STDIN =
      new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));

  static String line(String label) throws IOException {
    System.err.print(label);
    System.err.flush();
    if (CONSOLE != null) {
      return CONSOLE.readLine();
    }
    return STDIN.readLine();
  }

  static String secret(String label) throws IOException {
    if (CONSOLE != null) {
      System.err.print(label);
      System.err.flush();
      char[] chars = CONSOLE.readPassword();
      return chars == null ? "" : new String(chars);
    }
    // No console (e.g. spawned by a protocol handler) — fall back unmasked.
    return line(label);
  }

  /** Prompt the user to choose one of {@code count} options; returns 0-based index. */
  static int selectIndex(String label, int count) throws IOException {
    if (count <= 1) {
      return 0;
    }
    while (true) {
      String raw = line(label + " [1-" + count + "]: ");
      try {
        int choice = Integer.parseInt(raw.trim());
        if (choice >= 1 && choice <= count) {
          return choice - 1;
        }
      } catch (NumberFormatException ignored) {
        // re-prompt
      }
      System.err.println("Invalid selection.");
    }
  }
}
