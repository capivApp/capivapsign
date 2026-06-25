package com.documenso.icp;

import java.util.List;
import java.util.Map;

/** Text-based {@link Ui} for CMD/testing. Auto-selects a single certificate. */
final class ConsoleUi implements Ui {
  @Override
  public int chooseCertificate(List<Map<String, Object>> certs) throws Exception {
    if (certs.size() == 1) {
      return 0;
    }
    System.err.println("Select a certificate:");
    for (int i = 0; i < certs.size(); i++) {
      Map<String, Object> c = certs.get(i);
      System.err.printf("  [%d] %s - %s - %s%n", i + 1, c.get("commonName"), c.get("cpfCnpj"), c.get("type"));
    }
    return Prompt.selectIndex("Certificate", certs.size());
  }

  @Override
  public String secret(String label) throws Exception {
    return Prompt.secret(label);
  }

  @Override
  public String pickFile(String label) throws Exception {
    String path = Prompt.line(label + " (caminho do arquivo): ");
    if (path == null || path.isBlank()) {
      throw new IllegalArgumentException("No file selected.");
    }
    return path.trim();
  }

  @Override
  public void info(String message) {
    System.err.println(message);
  }
}
