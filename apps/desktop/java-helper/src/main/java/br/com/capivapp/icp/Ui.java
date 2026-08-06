package br.com.capivapp.icp;

import java.awt.GraphicsEnvironment;
import java.util.List;
import java.util.Map;

/**
 * User-interaction strategy: choosing a certificate and entering secrets.
 *
 * Two implementations, picked by how the agent was launched:
 *   - {@link ConsoleUi} — text prompts, for CMD/testing (a console is attached).
 *   - {@link SwingUi}    — native dialogs, for the protocol-handler / deep-link
 *     flow where there is no console to type into.
 *
 * The PIN for an A3 token via the Windows store is requested by the OS (CryptoAPI)
 * at signing time, not here.
 */
interface Ui {
  /** Returns the chosen certificate index, or throws if the user cancels. */
  int chooseCertificate(List<Map<String, Object>> certs) throws Exception;

  /** Prompts for a secret (P12 password / PKCS#11 PIN). */
  String secret(String label) throws Exception;

  /** Prompts the user to choose a file (e.g. an A1 .p12/.pfx); returns its path. */
  String pickFile(String label) throws Exception;

  /** Surfaces a message to the user. */
  void info(String message);

  /**
   * GUI when requested or when no console is attached (deep-link / windowed
   * launch) and a display exists; console otherwise.
   */
  static Ui create(boolean preferGui) {
    boolean wantGui = preferGui || System.console() == null;
    if (wantGui && !GraphicsEnvironment.isHeadless()) {
      return new SwingUi();
    }
    return new ConsoleUi();
  }
}
