# ICP-Brasil signing agent (Java, headless)

A small **headless** Java program that holds the signer's ICP-Brasil certificate
and signs **only digests** — never the document. It's the one piece that must run
on the signer's machine, because the browser can't reach a local A1 `.p12`, an A3
PKCS#11 token, or the Windows certificate store.

**No desktop UI needed.** The same jar runs in two modes:

1. **Standalone agent** (`sign`/`list` args, or a `capivasign-icp://` deep link) —
   does the whole remote flow itself. This is the shipping path; it replaces a
   Tauri/Electron app.
2. **NDJSON crypto helper** (no args) — `list`/`sign` over stdin/stdout, for
   embedding behind another process.

## How CapivaSign invokes it

The browser cannot launch a local exe directly. Two mechanisms; the agent
supports both with one binary:

- **Deep link (recommended for prod):** register `capivasign-icp://` (see
  `windows/register-protocol.reg`). The signing page navigates to
  `capivasign-icp://sign?baseUrl=…&token=<recipientToken>&source=windows-my`.
  Windows hands the URI to the agent.
- **CMD (for testing now):** `CapivaSignCli.exe sign --base-url … --token … --source …`

Either way the agent: **selects the cert → POST `/api/icp/sign/prepare` (sends the
chain, gets digests) → signs each digest locally → POST `/api/icp/sign/complete`
(sends signatures).** It never downloads the PDF. `complete` runs CapivaSign's
normal server-side notifications, so there's no separate callback URL — the web
page just watches the document status. Auth is by the **recipient token**
(capability, same trust as the signing link); no device pairing required.

> **Security:** set `ICP_ALLOWED_ORIGIN=https://app.capivapp.com.br` so the agent
> refuses any other host (a deep link is invokable by any page). Never put a
> password/PIN in the URL — secrets are prompted interactively.

## Certificate backends (A1 + A3)

`CertSource` is a **strategy**; `CertSourceFactory` the **factory**:

| `--source` | Backend | Notes |
|---|---|---|
| `p12` | A1 `.p12`/`.pfx` (PKCS#12) | `--p12 PATH [--password P]` |
| `pkcs11` | A3 token / smartcard (SunPKCS11) | `--module token.dll [--slot N] [--pin P]` |
| `windows-my` | A3 Windows store (SunMSCAPI) | no args; OS handles auth |

A1/PKCS#11 sign via raw RSA cipher over `DigestInfo`; Windows-MY via
`NONEwithRSA` (non-extractable keys). All produce the same RSASSA-PKCS1-v1_5
value libpdf embeds.

## Windows installer (.exe)

For an end-user Windows box, ship the one-click installer instead of asking the
signer to run scripts. On a Windows machine with **JDK 17+** and **[Inno Setup
6](https://jrsoftware.org/isdl.php)** on PATH:

```bat
windows\build-installer.bat https://app.suaempresa.com
REM -> dist\installer\CapivaSign-Setup.exe
```

`CapivaSign-Setup.exe` (admin) is fully self-contained (bundles a JRE) and:

1. installs the agent under `C:\Program Files\CapivaSign`;
2. registers the **`capivasign-icp://` deep link** per-machine (HKLM);
3. sets **`ICP_ALLOWED_ORIGIN`** (the origin passed to `build-installer.bat`) as a
   system env var, so the agent refuses any other host;
4. **auto-starts the serve agent at every user logon** via the HKLM `Run` key
   as `CapivaSign.exe` — it lives in the **system tray** (no
   "Aguardando…" window), keeps `http://127.0.0.1:3231/ping` answering, and only
   pops the **certificate/PIN selector** when a sign request actually arrives.

So the signing page works through either path with zero per-signer setup: the
loopback `serve` agent (tray) **or** the `capivasign-icp://` deep link.

> The Windows **service** route (Session 0) is deliberately avoided: a true
> service can't show the certificate/PIN dialogs to the user. Logon auto-start
> runs in the user session, so the picker appears. `windows\register-protocol.reg`
> remains for manual/dev registration without the installer.

## Build & run

```bash
./build.sh                      # Linux/macOS: javac -> build/icp-helper.jar (no Gradle/deps)
build.bat                       # Windows equivalent
windows\package-windows.bat     # Windows: self-contained app-image (jlink+jpackage, bundles a JRE)
windows\build-installer.bat     # Windows: one-click CapivaSign-Setup.exe (protocol + logon auto-start)
```

`package-windows.bat` produces **two** launchers, and which one you wire up
matters:

| Binary              | Subsystem | Default args     | Used for                                              |
| ------------------- | --------- | ---------------- | ----------------------------------------------------- |
| `CapivaSign.exe`    | windowed  | `serve --no-gui` | everything user-facing — logon, Start menu, deep link |
| `CapivaSignCli.exe` | console   | none             | support/debugging (`list`, `sign`)                    |

**The main launcher is windowed on purpose.** jpackage's `--win-console` builds a
console-subsystem binary, so Windows allocates and shows a cmd window on *every*
launch — at logon, from the Start menu, and on each `capivasign-icp://` deep link
the browser fires. That stray console next to the agent is exactly the bug this
split removes: the exe users actually run is a GUI-subsystem binary, and with no
arguments it goes straight to the system tray.

Because a windowed process has no console, stderr is teed to a log file instead:
`%LOCALAPPDATA%\CapivaSign\agent.log` (openable from the tray menu). Ask for that
file first when signing misbehaves. For interactive poking, use the CLI binary:

```bat
dist\CapivaSign\CapivaSignCli.exe list --source windows-my
```

```bash
# list certs
java -jar build/icp-helper.jar list --source p12 --p12 cert.p12 --password test
java -jar build/icp-helper.jar list --source windows-my

# sign (full remote flow)
java -jar build/icp-helper.jar sign --base-url https://app.capivapp.com.br \
     --token <RECIPIENT_TOKEN> --source pkcs11 --module C:\path\token.dll
```

## Tests (need `openssl` + network for the RFC3161 TSA)

- `cli-agent.e2e.mjs` — drives the jar in `sign` CLI mode against a mock
  CapivaSign server (real libpdf capture/embed) and verifies the agent's signature with
  openssl. Proves the deep-link/CMD flow end to end.
- `e2e-java.mjs` — drives the NDJSON helper through capture → sign → embed (B-T)
  → B-LTA seal.
- The production server modules are exercised against this jar by
  `packages/ee/server-only/signing/icp/__tests__/digest-signing.integration.ts`.

## Status

A1 is fully tested here. **A3 (PKCS#11 + Windows-MY) is implemented and compiles;
validate on a Windows box with a real token/store** — this environment has no
token and SunMSCAPI is Windows-only, so only the construction/error paths run
here. The Windows-MY signing path may need a `NONEwithRSA` vs cipher tweak per
token driver; flagged in `WindowsMyCertSource`.
