package br.com.capivapp.icp;

/**
 * Single source of truth for every user-visible name the desktop agent shows —
 * window titles, tray tooltip, balloon headings and the deep-link scheme.
 *
 * Kept in one place so the product name is never hardcoded at a call site: the
 * scheme in particular is duplicated in the Windows installer, the registry
 * file and the web signing page, and those must all agree.
 */
final class Brand {
  /** Product name, as shown to the signer. */
  static final String NAME = "CapivaSign";

  /** Long form used for window titles and the tray tooltip. */
  static final String AGENT_NAME = NAME + " — Assinador ICP-Brasil";

  /**
   * Custom URI scheme registered on Windows so the web signing page can launch
   * the agent. MUST match `windows/installer.iss`, `windows/register-protocol.reg`
   * and the web client (`icp-sign-panel.tsx`).
   */
  static final String PROTOCOL = "capivasign-icp";

  static final String PROTOCOL_PREFIX = PROTOCOL + "://";

  private Brand() {}
}
