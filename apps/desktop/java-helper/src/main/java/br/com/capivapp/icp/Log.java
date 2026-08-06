package br.com.capivapp.icp;

import java.io.IOException;
import java.io.OutputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Mirrors the agent's diagnostics into a rolling log file.
 *
 * The Windows tray launcher is deliberately WINDOWED — that is what stops a
 * console window from flashing up alongside the agent. The cost is that
 * `System.err` has nowhere to go, so a failed signature would otherwise leave
 * no trace at all. Every launch therefore tees stderr into
 * `%LOCALAPPDATA%\CapivaSign\agent.log` (`~/.local/state/capivasign/` elsewhere),
 * which is the first thing to ask a user for when signing misbehaves.
 *
 * Rotation is a single generation at 1 MB — enough to cover a signing session
 * without ever growing unbounded on a machine nobody administers.
 */
final class Log {
  private static final long MAX_BYTES = 1024L * 1024L;
  private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

  private static volatile Path file;

  private Log() {}

  /** Path of the active log file, or null when logging could not be set up. */
  static Path file() {
    return file;
  }

  /**
   * Redirect {@code System.err} through a tee that also appends to the log
   * file. Safe to call once at startup; failures are swallowed, because losing
   * logging must never stop the user from signing.
   */
  static void install() {
    try {
      Path directory = logDirectory();
      Files.createDirectories(directory);

      Path target = directory.resolve("agent.log");
      rotateIfOversized(target);
      file = target;

      OutputStream sink = Files.newOutputStream(target, StandardOpenOption.CREATE, StandardOpenOption.APPEND);
      System.setErr(new PrintStream(new TeeStream(System.err, sink), true, StandardCharsets.UTF_8));

      System.err.println();
      System.err.println("=== " + Brand.NAME + " agent started " + LocalDateTime.now().format(STAMP) + " ===");
    } catch (Exception e) {
      // No logging available — keep going regardless.
    }
  }

  private static Path logDirectory() {
    String os = System.getProperty("os.name", "").toLowerCase();

    if (os.contains("win")) {
      String localAppData = System.getenv("LOCALAPPDATA");
      Path base = localAppData == null || localAppData.isBlank()
          ? Path.of(System.getProperty("user.home"), "AppData", "Local")
          : Path.of(localAppData);
      return base.resolve(Brand.NAME);
    }

    if (os.contains("mac")) {
      return Path.of(System.getProperty("user.home"), "Library", "Logs", Brand.NAME);
    }

    return Path.of(System.getProperty("user.home"), ".local", "state", "capivasign");
  }

  private static void rotateIfOversized(Path target) throws IOException {
    if (Files.exists(target) && Files.size(target) > MAX_BYTES) {
      Files.deleteIfExists(target.resolveSibling("agent.log.1"));
      Files.move(target, target.resolveSibling("agent.log.1"));
    }
  }

  /** Writes to both streams; a failure on either side never breaks the other. */
  private static final class TeeStream extends OutputStream {
    private final OutputStream console;
    private final OutputStream sink;

    TeeStream(OutputStream console, OutputStream sink) {
      this.console = console;
      this.sink = sink;
    }

    @Override
    public void write(int b) {
      writeQuietly(() -> console.write(b));
      writeQuietly(() -> sink.write(b));
    }

    @Override
    public void write(byte[] b, int off, int len) {
      writeQuietly(() -> console.write(b, off, len));
      writeQuietly(() -> sink.write(b, off, len));
    }

    @Override
    public void flush() {
      writeQuietly(console::flush);
      writeQuietly(sink::flush);
    }

    @FunctionalInterface
    private interface IoAction {
      void run() throws IOException;
    }

    private static void writeQuietly(IoAction action) {
      try {
        action.run();
      } catch (IOException e) {
        // A windowed launcher has no real stderr; dropping the write is correct.
      }
    }
  }
}
