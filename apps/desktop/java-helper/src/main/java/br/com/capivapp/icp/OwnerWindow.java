package br.com.capivapp.icp;

/**
 * The one owner window of the whole signing UI, for the life of the process.
 *
 * Why it exists: on Windows every owned window (our certificate picker, the
 * file chooser, the PIN prompt a smart card CSP opens from inside SunMSCAPI) is
 * created against an owner HWND. The old code built a throwaway parent frame
 * per dialog and disposed it right after, from a worker thread. Any window that
 * got created against an owner that was already being destroyed failed in
 * {@code CreateWindowEx} with ERROR_INVALID_WINDOW_HANDLE (1400), surfacing as
 * {@code InternalError: Identificador da janela inválido} and the picker never
 * appeared; a CSP that remembered that owner failed the same way later.
 *
 * This window is created once, shown (and raised) while at least one signing
 * session is open, hidden afterwards and NEVER disposed: hiding keeps its HWND
 * alive, so nothing can ever be parented to a destroyed window.
 *
 * The native side is a {@link Peer} strategy so the lifecycle is testable
 * without a desktop.
 */
final class OwnerWindow<W> {
  /** Native-side operations; the Swing implementation runs them on the EDT. */
  interface Peer<W> {
    W create();

    void show(W window);

    void hide(W window);
  }

  private final Peer<W> peer;
  private W window;
  private int openSessions;

  OwnerWindow(Peer<W> peer) {
    this.peer = peer;
  }

  /** Opens a session: the window exists, is visible and in front until it closes. */
  synchronized Ui.Session acquire() {
    if (window == null) {
      window = peer.create();
    }
    openSessions++;
    peer.show(window);
    return new OnceSession();
  }

  /** The owner every dialog of an open session must be parented to. */
  synchronized W window() {
    return window;
  }

  private synchronized void release() {
    openSessions--;
    if (openSessions > 0) {
      return;
    }
    peer.hide(window);
  }

  /** Releases its hold exactly once, however many times it is closed. */
  private final class OnceSession implements Ui.Session {
    private boolean isClosed;

    @Override
    public void close() {
      synchronized (OwnerWindow.this) {
        if (isClosed) {
          return;
        }
        isClosed = true;
        release();
      }
    }
  }
}
