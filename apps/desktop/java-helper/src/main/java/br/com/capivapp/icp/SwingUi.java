package br.com.capivapp.icp;

import java.awt.BorderLayout;
import java.awt.EventQueue;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.lang.reflect.InvocationTargetException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.atomic.AtomicReference;
import javax.swing.BorderFactory;
import javax.swing.DefaultListModel;
import javax.swing.JDialog;
import javax.swing.JFileChooser;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JList;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JPasswordField;
import javax.swing.JScrollPane;
import javax.swing.ListSelectionModel;
import javax.swing.WindowConstants;
import javax.swing.filechooser.FileNameExtensionFilter;

/**
 * Native-dialog {@link Ui} for the deep-link / server / windowed flow (no
 * console).
 *
 * Shows a certificate picker and a masked secret field via Swing. Always shows
 * the picker, even for a single certificate, so the signer confirms which
 * identity (and CPF/CNPJ) they are about to sign with.
 *
 * Two rules keep native windows valid (see {@link OwnerWindow} for the bug they
 * fix):
 *   - every dialog is owned by the ONE process-wide owner window, which is
 *     visible, always on top and in front for the whole signing session and is
 *     never disposed, so neither our dialogs nor a CSP PIN prompt can be
 *     parented to a destroyed HWND;
 *   - every Swing call runs on the EDT. Requests arrive on HTTP worker threads
 *     (or the main thread for a deep link); building and disposing windows
 *     there raced the EDT.
 *
 * The owner is read on the CALLING thread and only then handed to the EDT: the
 * EDT never takes the {@link OwnerWindow} lock, which a worker may hold while it
 * waits for the EDT.
 */
final class SwingUi implements Ui {
  private static final String TITLE = Brand.NAME + " · Assinatura ICP-Brasil";

  private static final OwnerWindow<JFrame> OWNER = new OwnerWindow<>(new SwingOwnerPeer());

  @Override
  public Session openSession() {
    return OWNER.acquire();
  }

  @Override
  public int chooseCertificate(List<Map<String, Object>> certs) throws Exception {
    JFrame owner = OWNER.window();
    int selected = onEdt(() -> showCertificatePicker(certs, owner));

    if (selected < 0) {
      throw new IllegalStateException("Signing cancelled by the user.");
    }
    return selected;
  }

  @Override
  public String secret(String label) throws Exception {
    JFrame owner = OWNER.window();
    String secret = onEdt(() -> showSecretPrompt(label, owner));

    if (secret == null) {
      throw new IllegalStateException("Cancelled by the user.");
    }
    return secret;
  }

  @Override
  public String pickFile(String label) throws Exception {
    JFrame owner = OWNER.window();
    String path = onEdt(() -> showFileChooser(label, owner));

    if (path == null) {
      throw new IllegalStateException("No file selected.");
    }
    return path;
  }

  @Override
  public void info(String message) {
    JFrame owner = OWNER.window();
    runOnEdt(() -> showOnTop(new JOptionPane(message, JOptionPane.INFORMATION_MESSAGE), owner));
  }

  // ---- dialogs (EDT only) ---------------------------------------------------

  /** @return the chosen index, or -1 when the user cancels. */
  private static int showCertificatePicker(List<Map<String, Object>> certs, JFrame owner) {
    DefaultListModel<String> model = new DefaultListModel<>();
    for (Map<String, Object> c : certs) {
      model.addElement(String.format("<html><b>%s</b><br/>%s · %s · válido até %s</html>",
          c.get("commonName"), labelType(c.get("type")), c.get("cpfCnpj"), shortDate(c.get("notAfter"))));
    }

    JList<String> list = new JList<>(model);
    list.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
    list.setSelectedIndex(0);
    list.setBorder(BorderFactory.createEmptyBorder(4, 4, 4, 4));

    JPanel panel = new JPanel(new BorderLayout(0, 8));
    panel.add(new JLabel("Selecione o certificado para assinar:"), BorderLayout.NORTH);
    panel.add(new JScrollPane(list), BorderLayout.CENTER);

    if (showOptionPane(panel, owner) != JOptionPane.OK_OPTION) {
      return -1;
    }
    return list.getSelectedIndex();
  }

  /** @return the typed secret, or null when the user cancels. */
  private static String showSecretPrompt(String label, JFrame owner) {
    JPasswordField field = new JPasswordField(24);
    JPanel panel = new JPanel(new BorderLayout(0, 6));
    panel.add(new JLabel(label), BorderLayout.NORTH);
    panel.add(field, BorderLayout.CENTER);

    if (showOptionPane(panel, owner) != JOptionPane.OK_OPTION) {
      return null;
    }
    return new String(field.getPassword());
  }

  /** @return the chosen path, or null when nothing was chosen. */
  private static String showFileChooser(String label, JFrame owner) {
    JFileChooser chooser = new JFileChooser();
    chooser.setDialogTitle(label);
    chooser.setFileFilter(new FileNameExtensionFilter("Certificado A1 (*.p12, *.pfx)", "p12", "pfx"));

    if (chooser.showOpenDialog(owner) != JFileChooser.APPROVE_OPTION) {
      return null;
    }
    return chooser.getSelectedFile().getAbsolutePath();
  }

  /** Show an OK/CANCEL option pane forced to the front; returns the option int. */
  private static int showOptionPane(Object message, JFrame owner) {
    JOptionPane pane = new JOptionPane(message, JOptionPane.PLAIN_MESSAGE, JOptionPane.OK_CANCEL_OPTION);
    showOnTop(pane, owner);

    Object value = pane.getValue();
    return value instanceof Integer ? (Integer) value : JOptionPane.CLOSED_OPTION;
  }

  /**
   * Build the pane's dialog as always-on-top and raise it once shown. A sign
   * request arrives while the user is looking at the browser, so a dialog that
   * opened behind it would be missed.
   */
  private static void showOnTop(JOptionPane pane, JFrame owner) {
    JDialog dialog = pane.createDialog(owner, TITLE);
    dialog.setAlwaysOnTop(true);
    dialog.addWindowListener(new WindowAdapter() {
      @Override
      public void windowOpened(WindowEvent e) {
        dialog.toFront();
        dialog.requestFocus();
      }
    });

    dialog.setVisible(true); // Modal: pumps events on the EDT until dismissed.
    dialog.dispose(); // The dialog only; the owner stays alive.
  }

  // ---- owner window ---------------------------------------------------------

  /**
   * An invisible (transparent 1px), always-on-top frame. Shown and raised for a
   * session, hidden after it; hiding keeps the HWND, dispose would destroy it,
   * so it is never disposed.
   */
  private static final class SwingOwnerPeer implements OwnerWindow.Peer<JFrame> {
    @Override
    public JFrame create() {
      return callOnEdt(SwingUi::buildOwnerFrame);
    }

    @Override
    public void show(JFrame frame) {
      runOnEdt(() -> {
        frame.setVisible(true);
        frame.toFront();
        frame.requestFocus();
      });
    }

    @Override
    public void hide(JFrame frame) {
      runOnEdt(() -> frame.setVisible(false));
    }
  }

  private static JFrame buildOwnerFrame() {
    JFrame frame = new JFrame(Brand.AGENT_NAME);
    frame.setIconImage(ServeMode.trayImage());
    frame.setUndecorated(true);
    frame.setSize(1, 1);
    frame.setLocationRelativeTo(null);
    frame.setAlwaysOnTop(true);
    frame.setFocusableWindowState(true);
    // Closing it (e.g. Alt+F4 while it has focus) must never dispose it.
    frame.setDefaultCloseOperation(WindowConstants.DO_NOTHING_ON_CLOSE);

    try {
      frame.setOpacity(0f);
    } catch (Exception ignored) {
      // Per-pixel translucency unsupported: a 1px frame is still effectively invisible.
    }
    return frame;
  }

  // ---- EDT helpers ----------------------------------------------------------

  /** Runs {@code task} on the EDT and returns its result, rethrowing its failure. */
  private static <T> T onEdt(Callable<T> task) throws Exception {
    if (EventQueue.isDispatchThread()) {
      return task.call();
    }

    AtomicReference<T> result = new AtomicReference<>();
    try {
      EventQueue.invokeAndWait(() -> result.set(callUnchecked(task)));
    } catch (InvocationTargetException e) {
      throw unwrap(e.getCause());
    }
    return result.get();
  }

  private static <T> T callOnEdt(Callable<T> task) {
    try {
      return onEdt(task);
    } catch (RuntimeException | Error e) {
      throw e;
    } catch (Exception e) {
      throw new IllegalStateException(e.getMessage(), e);
    }
  }

  private static void runOnEdt(Runnable task) {
    callOnEdt(() -> {
      task.run();
      return null;
    });
  }

  private static <T> T callUnchecked(Callable<T> task) {
    try {
      return task.call();
    } catch (RuntimeException e) {
      throw e;
    } catch (Exception e) {
      throw new CheckedFailure(e);
    }
  }

  private static Exception unwrap(Throwable cause) {
    if (cause instanceof CheckedFailure failure) {
      return (Exception) failure.getCause();
    }
    if (cause instanceof Error error) {
      throw error;
    }
    return (Exception) cause;
  }

  /** Carries a checked exception out of an EDT runnable. */
  private static final class CheckedFailure extends RuntimeException {
    CheckedFailure(Exception cause) {
      super(cause);
    }
  }

  private static String labelType(Object type) {
    return "A3".equals(type) ? "A3 (token/cartão)" : "A1 (arquivo)";
  }

  private static String shortDate(Object iso) {
    String s = String.valueOf(iso);
    return s.length() >= 10 ? s.substring(0, 10) : s;
  }
}
