package br.com.capivapp.icp;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.MessageDigest;
import java.security.Signature;
import java.util.ArrayList;
import java.util.List;

/**
 * Plain-JDK test runner: every signing strategy must produce a standard
 * RSASSA-PKCS1-v1_5 signature over the {@code signedAttrs}, i.e. one that
 * {@code SHA256withRSA} verifies. A signature over the bare hash (no DigestInfo)
 * is rejected by the ITI validator as "Cifra assimétrica: Reprovada".
 * Run via {@code ./test.sh}.
 */
public final class RawDigestSignerTest {
  private static final List<String> failures = new ArrayList<>();
  private static int passed = 0;

  private static final byte[] SIGNED_ATTRS = "signedAttrs DER stand-in".getBytes(StandardCharsets.UTF_8);

  private RawDigestSignerTest() {}

  public static void main(String[] args) throws Exception {
    KeyPair keyPair = newRsaKeyPair();

    cipherStrategyProducesAStandardSignature(keyPair);
    jcaSignatureStrategyProducesAStandardSignature(keyPair);
    jcaSignatureStrategyRequiresTheSignedAttrs(keyPair);
    signInputRejectsSignedAttrsThatDoNotMatchTheDigest();

    System.out.println("RawDigestSignerTest: " + passed + " passed, " + failures.size() + " failed");
    failures.forEach((failure) -> System.out.println("  FAIL " + failure));
    if (!failures.isEmpty()) {
      System.exit(1);
    }
  }

  private static void cipherStrategyProducesAStandardSignature(KeyPair keyPair) throws Exception {
    byte[] signature = RawDigestSigner.cipher(keyPair.getPrivate(), null).sign(signInput());

    expect("cipher strategy signature verifies as SHA256withRSA", isValidSha256WithRsa(keyPair, signature));
  }

  // The Windows-MY path. SunMSCAPI's NONEwithRSA omits the DigestInfo, so the
  // strategy has to hash the signedAttrs itself through SHA256withRSA.
  private static void jcaSignatureStrategyProducesAStandardSignature(KeyPair keyPair) throws Exception {
    byte[] signature = RawDigestSigner.jcaSignature(keyPair.getPrivate(), null).sign(signInput());

    expect("jcaSignature strategy signature verifies as SHA256withRSA", isValidSha256WithRsa(keyPair, signature));
  }

  private static void jcaSignatureStrategyRequiresTheSignedAttrs(KeyPair keyPair) throws Exception {
    SignInput digestOnly = SignInput.of(sha256(SIGNED_ATTRS), null, "SHA-256");

    expect("jcaSignature strategy refuses a digest-only request",
        throwsOn(() -> RawDigestSigner.jcaSignature(keyPair.getPrivate(), null).sign(digestOnly)));
  }

  private static void signInputRejectsSignedAttrsThatDoNotMatchTheDigest() throws Exception {
    byte[] otherDigest = sha256("something else".getBytes(StandardCharsets.UTF_8));

    expect("SignInput rejects signedAttrs whose hash differs from the digest",
        throwsOn(() -> SignInput.of(otherDigest, SIGNED_ATTRS, "SHA-256")));
  }

  private static SignInput signInput() throws Exception {
    return SignInput.of(sha256(SIGNED_ATTRS), SIGNED_ATTRS, "SHA-256");
  }

  private static boolean isValidSha256WithRsa(KeyPair keyPair, byte[] signature) throws Exception {
    Signature verifier = Signature.getInstance("SHA256withRSA");
    verifier.initVerify(keyPair.getPublic());
    verifier.update(SIGNED_ATTRS);
    return verifier.verify(signature);
  }

  private static KeyPair newRsaKeyPair() throws Exception {
    KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
    generator.initialize(2048);
    return generator.generateKeyPair();
  }

  private static byte[] sha256(byte[] data) throws Exception {
    return MessageDigest.getInstance("SHA-256").digest(data);
  }

  @FunctionalInterface
  private interface Action {
    void run() throws Exception;
  }

  private static boolean throwsOn(Action action) {
    try {
      action.run();
      return false;
    } catch (Exception e) {
      return true;
    }
  }

  private static void expect(String description, boolean condition) {
    if (condition) {
      passed++;
      return;
    }
    failures.add(description);
  }
}
