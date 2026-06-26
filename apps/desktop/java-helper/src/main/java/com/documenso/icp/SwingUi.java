package com.documenso.icp;

import java.awt.BorderLayout;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.util.List;
import java.util.Map;
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
import javax.swing.filechooser.FileNameExtensionFilter;

/**
 * Native-dialog {@link Ui} for the deep-link / server / windowed flow (no
 * console).
 *
 * Shows a certificate picker and a masked secret field via Swing. Always shows
 * the picker — even for a single certificate — so the signer confirms which
 * identity (and CPF/CNPJ) they are about to sign with.
 *
 * Every dialog is forced to the front with keyboard focus (an always-on-top,
 * focused parent window + `toFront()`): a sign request arrives while the user is
 * looking at the browser, so a dialog that opened behind it would be invisible
 * and could be missed (or worse, the wrong cert confirmed blindly).
 */
final class SwingUi implements Ui {
  private static final String TITLE = "Documenso · Assinatura ICP-Brasil";

  @Override
  public int chooseCertificate(List<Map<String, Object>> certs) throws Exception {
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

    int result = showOptionPane(panel);

    if (result != JOptionPane.OK_OPTION || list.getSelectedIndex() < 0) {
      throw new IllegalStateException("Signing cancelled by the user.");
    }
    return list.getSelectedIndex();
  }

  @Override
  public String secret(String label) throws Exception {
    JPasswordField field = new JPasswordField(24);
    JPanel panel = new JPanel(new BorderLayout(0, 6));
    panel.add(new JLabel(label), BorderLayout.NORTH);
    panel.add(field, BorderLayout.CENTER);

    int result = showOptionPane(panel);

    if (result != JOptionPane.OK_OPTION) {
      throw new IllegalStateException("Cancelled by the user.");
    }
    return new String(field.getPassword());
  }

  @Override
  public String pickFile(String label) throws Exception {
    JFrame parent = focusParent();
    try {
      JFileChooser chooser = new JFileChooser();
      chooser.setDialogTitle(label);
      chooser.setFileFilter(new FileNameExtensionFilter("Certificado A1 (*.p12, *.pfx)", "p12", "pfx"));

      if (chooser.showOpenDialog(parent) != JFileChooser.APPROVE_OPTION) {
        throw new IllegalStateException("No file selected.");
      }
      return chooser.getSelectedFile().getAbsolutePath();
    } finally {
      parent.dispose();
    }
  }

  @Override
  public void info(String message) {
    JFrame parent = focusParent();
    try {
      JOptionPane pane = new JOptionPane(message, JOptionPane.INFORMATION_MESSAGE);
      showOnTop(pane, parent);
    } finally {
      parent.dispose();
    }
  }

  // ---- focus helpers --------------------------------------------------------

  /** Show an OK/CANCEL option pane forced to the front; returns the option int. */
  private int showOptionPane(Object message) {
    JFrame parent = focusParent();
    try {
      JOptionPane pane = new JOptionPane(message, JOptionPane.PLAIN_MESSAGE, JOptionPane.OK_CANCEL_OPTION);
      showOnTop(pane, parent);

      Object value = pane.getValue();
      return value instanceof Integer ? (Integer) value : JOptionPane.CLOSED_OPTION;
    } finally {
      parent.dispose();
    }
  }

  /** Build the pane's dialog as always-on-top and raise it once shown. */
  private static void showOnTop(JOptionPane pane, JFrame parent) {
    JDialog dialog = pane.createDialog(parent, TITLE);
    dialog.setAlwaysOnTop(true);
    dialog.addWindowListener(new WindowAdapter() {
      @Override
      public void windowOpened(WindowEvent e) {
        dialog.toFront();
        dialog.requestFocus();
      }
    });

    dialog.setVisible(true); // Modal — blocks until dismissed.
    dialog.dispose();
  }

  /**
   * An invisible, always-on-top, focused parent window so child dialogs surface
   * above the browser/other windows and grab keyboard focus. Caller disposes it.
   */
  private static JFrame focusParent() {
    JFrame frame = new JFrame();
    frame.setUndecorated(true);
    frame.setSize(1, 1);
    frame.setLocationRelativeTo(null);
    frame.setAlwaysOnTop(true);
    frame.setFocusableWindowState(true);

    try {
      frame.setOpacity(0f);
    } catch (Exception ignored) {
      // Per-pixel translucency unsupported — a 1px frame is still effectively invisible.
    }

    frame.setVisible(true);
    frame.toFront();
    frame.requestFocus();
    return frame;
  }

  private static String labelType(Object type) {
    return "A3".equals(type) ? "A3 (token/cartão)" : "A1 (arquivo)";
  }

  private static String shortDate(Object iso) {
    String s = String.valueOf(iso);
    return s.length() >= 10 ? s.substring(0, 10) : s;
  }
}
