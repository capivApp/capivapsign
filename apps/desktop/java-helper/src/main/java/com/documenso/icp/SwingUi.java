package com.documenso.icp;

import java.awt.BorderLayout;
import java.util.List;
import java.util.Map;
import javax.swing.BorderFactory;
import javax.swing.DefaultListModel;
import javax.swing.JLabel;
import javax.swing.JList;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JPasswordField;
import javax.swing.JScrollPane;
import javax.swing.ListSelectionModel;

/**
 * Native-dialog {@link Ui} for the deep-link / windowed flow (no console).
 *
 * Shows a certificate picker and a masked secret field via Swing. Always shows
 * the picker — even for a single certificate — so the signer confirms which
 * identity (and CPF/CNPJ) they are about to sign with.
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

    int result = JOptionPane.showConfirmDialog(
        null, panel, TITLE, JOptionPane.OK_CANCEL_OPTION, JOptionPane.PLAIN_MESSAGE);

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

    int result = JOptionPane.showConfirmDialog(
        null, panel, TITLE, JOptionPane.OK_CANCEL_OPTION, JOptionPane.PLAIN_MESSAGE);

    if (result != JOptionPane.OK_OPTION) {
      throw new IllegalStateException("Cancelled by the user.");
    }
    return new String(field.getPassword());
  }

  @Override
  public String pickFile(String label) throws Exception {
    javax.swing.JFileChooser chooser = new javax.swing.JFileChooser();
    chooser.setDialogTitle(label);
    chooser.setFileFilter(new javax.swing.filechooser.FileNameExtensionFilter("Certificado A1 (*.p12, *.pfx)", "p12", "pfx"));
    if (chooser.showOpenDialog(null) != javax.swing.JFileChooser.APPROVE_OPTION) {
      throw new IllegalStateException("No file selected.");
    }
    return chooser.getSelectedFile().getAbsolutePath();
  }

  @Override
  public void info(String message) {
    JOptionPane.showMessageDialog(null, message, TITLE, JOptionPane.INFORMATION_MESSAGE);
  }

  private static String labelType(Object type) {
    return "A3".equals(type) ? "A3 (token/cartão)" : "A1 (arquivo)";
  }

  private static String shortDate(Object iso) {
    String s = String.valueOf(iso);
    return s.length() >= 10 ? s.substring(0, 10) : s;
  }
}
