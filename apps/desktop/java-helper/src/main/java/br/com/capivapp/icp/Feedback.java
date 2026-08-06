package br.com.capivapp.icp;

import java.awt.GraphicsEnvironment;
import java.awt.TrayIcon;
import javax.swing.JOptionPane;
import javax.swing.SwingUtilities;

/**
 * How the agent tells the signer what happened.
 *
 * The Windows launcher is windowed, so stdout/stderr are not visible to anyone
 * — every outcome the user needs to know about has to become a tray balloon or
 * a dialog. Which one depends on how the agent is running:
 *
 *   - tray agent (auto-started, always on)  -> balloon, never steals focus;
 *   - one-shot deep-link launch             -> modal dialog, since there is no
 *     tray icon of our own to hang a balloon off.
 *
 * Console launches (the CLI exe) get neither: stderr already carries the
 * message and a blocking dialog would strand a scripted run.
 */
final class Feedback {
  private static volatile TrayIcon trayIcon;

  private Feedback() {}

  /** Registered by {@link ServeMode} once the tray icon exists. */
  static void useTray(TrayIcon icon) {
    trayIcon = icon;
  }

  /** @return true when something was actually put on screen. */
  static boolean success(String message) {
    return show(true, message);
  }

  /** @return true when something was actually put on screen. */
  static boolean failure(String message) {
    return show(false, message);
  }

  private static boolean show(boolean ok, String message) {
    if (GraphicsEnvironment.isHeadless()) {
      return false;
    }

    String title = ok ? Brand.NAME + " — Sucesso" : Brand.NAME + " — Erro";

    TrayIcon icon = trayIcon;

    if (icon != null) {
      icon.displayMessage(title, message, ok ? TrayIcon.MessageType.INFO : TrayIcon.MessageType.ERROR);
      return true;
    }

    // No tray icon: this is a one-shot launch. A console run already printed the
    // message, so only pop a dialog when there is no console to read.
    if (System.console() != null) {
      return false;
    }

    SwingUtilities.invokeLater(() -> JOptionPane.showMessageDialog(
        null,
        message,
        title,
        ok ? JOptionPane.INFORMATION_MESSAGE : JOptionPane.ERROR_MESSAGE));
    return true;
  }
}
