package com.documenso.icp;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.awt.AWTException;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.GraphicsEnvironment;
import java.awt.Image;
import java.awt.MenuItem;
import java.awt.PopupMenu;
import java.awt.RenderingHints;
import java.awt.SystemTray;
import java.awt.TrayIcon;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.Executors;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.SwingConstants;
import javax.swing.SwingUtilities;

/**
 * Local HTTP server mode for the CapivaSign agent.
 *
 * Listens on http://127.0.0.1:3231 and shows an "Aguardando pedido de
 * assinatura…" window. The Documenso signing page probes `/ping` and, when the
 * agent is running, POSTs the sign request to `/sign` instead of relying on the
 * `documenso-icp://` deep link / protocol handler. This makes A1/A3 signing work
 * on any OS (notably Linux) without registering a custom URI scheme.
 *
 * CORS is open (`*`) because the request originates from the Documenso web
 * origin; the actual authorisation is the unguessable recipient token in the
 * body, and the key never leaves the machine.
 */
final class ServeMode {
  static final int PORT = 3231;

  // Set in `--no-gui` (tray) mode; result feedback then goes to a tray balloon
  // instead of a modal dialog. The cert/PIN pickers still show (they MUST, the
  // user has to choose an identity) — only the idle "waiting" window is dropped.
  private static volatile TrayIcon trayIcon;

  private ServeMode() {}

  /**
   * @param tray when true (auto-start / `serve --no-gui`), run silently in the
   *     system tray: no "waiting" window, results shown as tray balloons. When
   *     false, show the foreground waiting window (manual `serve`).
   */
  static void start(boolean tray) throws IOException {
    HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", PORT), 0);
    server.createContext("/ping", ServeMode::handlePing);
    server.createContext("/sign", ServeMode::handleSign);
    // A pool (not a single thread): a signing request blocks its thread for as
    // long as the user takes at the certificate/PIN dialogs, so the server must
    // stay responsive for /ping and retries meanwhile.
    server.setExecutor(Executors.newCachedThreadPool());
    server.start();

    if (tray) {
      installTray();
    } else {
      showWaitingWindow();
    }
    System.err.println("CapivaSign agent listening on http://127.0.0.1:" + PORT
        + (tray ? " (tray)" : ""));
  }

  private static void handlePing(HttpExchange exchange) throws IOException {
    if (isPreflight(exchange)) {
      respond(exchange, 204, "");
      return;
    }
    respond(exchange, 200, Json.write(Map.of("ok", Boolean.TRUE, "agent", "capivasign")));
  }

  private static void handleSign(HttpExchange exchange) throws IOException {
    if (isPreflight(exchange)) {
      respond(exchange, 204, "");
      return;
    }
    if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
      respond(exchange, 405, Json.write(error("POST only")));
      return;
    }

    // Catch Throwable (not just Exception): an uncaught Error here would kill the
    // worker thread WITHOUT sending a response, leaving the browser request
    // hanging "pending" forever with no feedback. Always respond and always
    // surface the outcome to the user so signing is never silent.
    try {
      String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
      Map<String, Object> request = Json.asObject(Json.parse(body));

      Map<String, String> opts = CliAgent.optsFromRequest(
          Json.str(request, "baseUrl"), Json.str(request, "token"), Json.str(request, "source"));

      System.err.println("→ /sign request: baseUrl=" + opts.get("base-url") + " source=" + opts.get("source"));

      // GUI prompts for cert selection / PIN / .p12 file + password.
      Map<String, Object> result = CliAgent.performSign(opts, Ui.create(true));

      System.err.println("✓ /sign done: " + result);
      respond(exchange, 200, Json.write(result));
      showResult(true, "Assinatura concluída com sucesso.");
    } catch (Throwable e) {
      String message = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
      System.err.println("✗ /sign failed: " + message);
      e.printStackTrace();
      respond(exchange, 500, Json.write(error(message)));
      showResult(false, "Falha ao assinar:\n" + message);
    }
  }

  /** Pop a non-blocking result so the signer always gets feedback. */
  private static void showResult(boolean ok, String message) {
    if (GraphicsEnvironment.isHeadless()) {
      return;
    }
    // Tray mode: a balloon, so we never steal focus or block the desktop.
    if (trayIcon != null) {
      trayIcon.displayMessage(
          ok ? "CapivaSign — Sucesso" : "CapivaSign — Erro",
          message,
          ok ? TrayIcon.MessageType.INFO : TrayIcon.MessageType.ERROR);
      return;
    }
    SwingUtilities.invokeLater(() ->
        JOptionPane.showMessageDialog(
            null,
            message,
            ok ? "CapivaSign — Sucesso" : "CapivaSign — Erro",
            ok ? JOptionPane.INFORMATION_MESSAGE : JOptionPane.ERROR_MESSAGE));
  }

  // ---- system tray (--no-gui / auto-start) ----------------------------------

  /**
   * Install a tray icon with a "Sair" menu so the silently-running agent is
   * discoverable and quittable. No-op when the platform has no tray (the agent
   * keeps serving regardless).
   */
  private static void installTray() {
    if (GraphicsEnvironment.isHeadless() || !SystemTray.isSupported()) {
      return;
    }

    SystemTray tray = SystemTray.getSystemTray();

    MenuItem status = new MenuItem("Assinador ativo · porta " + PORT);
    status.setEnabled(false);
    MenuItem quit = new MenuItem("Sair");

    PopupMenu menu = new PopupMenu();
    menu.add(status);
    menu.addSeparator();
    menu.add(quit);

    TrayIcon icon = new TrayIcon(buildTrayImage(), "CapivaSign — Assinador ICP-Brasil", menu);
    icon.setImageAutoSize(true);
    quit.addActionListener((e) -> {
      tray.remove(icon);
      System.exit(0);
    });

    try {
      tray.add(icon);
      trayIcon = icon;
      icon.displayMessage(
          "CapivaSign", "Assinador ICP-Brasil em execução.", TrayIcon.MessageType.INFO);
    } catch (AWTException e) {
      System.err.println("Tray unavailable: " + e.getMessage());
    }
  }

  /** A tiny rounded "C" glyph so we don't ship a binary icon asset. */
  private static Image buildTrayImage() {
    int size = 16;
    BufferedImage image = new BufferedImage(size, size, BufferedImage.TYPE_INT_ARGB);
    Graphics2D g = image.createGraphics();
    g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
    g.setColor(new Color(0x25, 0x63, 0xEB));
    g.fillRoundRect(0, 0, size, size, 6, 6);
    g.setColor(Color.WHITE);
    g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 12));
    g.drawString("C", 4, 12);
    g.dispose();
    return image;
  }

  // ---- helpers --------------------------------------------------------------

  private static boolean isPreflight(HttpExchange exchange) {
    return "OPTIONS".equalsIgnoreCase(exchange.getRequestMethod());
  }

  private static void respond(HttpExchange exchange, int status, String body) throws IOException {
    exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
    exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "content-type");
    exchange.getResponseHeaders().add("Content-Type", "application/json; charset=utf-8");

    byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
    // 204 must not carry a body length.
    exchange.sendResponseHeaders(status, status == 204 ? -1 : bytes.length);
    if (status != 204) {
      exchange.getResponseBody().write(bytes);
    }
    exchange.close();
  }

  private static Map<String, Object> error(String message) {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("ok", Boolean.FALSE);
    map.put("error", message);
    return map;
  }

  private static void showWaitingWindow() {
    if (GraphicsEnvironment.isHeadless()) {
      return;
    }
    SwingUtilities.invokeLater(() -> {
      JFrame frame = new JFrame("CapivaSign — Assinador ICP-Brasil");
      frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
      JLabel label = new JLabel(
          "<html><div style='padding:24px;text-align:center;font-family:sans-serif;'>"
              + "<h2>Aguardando pedido de assinatura…</h2>"
              + "<p>Deixe esta janela aberta. Ao assinar no navegador,<br/>"
              + "o pedido chega aqui (porta 3231) e o seu certificado é usado.</p></div></html>",
          SwingConstants.CENTER);
      frame.add(label);
      frame.setSize(440, 210);
      frame.setLocationRelativeTo(null);
      frame.setVisible(true);
    });
  }
}
