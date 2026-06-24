# ICP-Brasil signing agent (Java, headless)

A small **headless** Java program that holds the signer's ICP-Brasil certificate
and signs **only digests** — never the document. It's the one piece that must run
on the signer's machine, because the browser can't reach a local A1 `.p12`, an A3
PKCS#11 token, or the Windows certificate store.

**No desktop UI needed.** The same jar runs in two modes:

1. **Standalone agent** (`sign`/`list` args, or a `documenso-icp://` deep link) —
   does the whole remote flow itself. This is the shipping path; it replaces a
   Tauri/Electron app.
2. **NDJSON crypto helper** (no args) — `list`/`sign` over stdin/stdout, for
   embedding behind another process.

## How Documenso invokes it

The browser cannot launch a local exe directly. Two mechanisms; the agent
supports both with one binary:

- **Deep link (recommended for prod):** register `documenso-icp://` (see
  `windows/register-protocol.reg`). The signing page navigates to
  `documenso-icp://sign?baseUrl=…&token=<recipientToken>&source=windows-my`.
  Windows hands the URI to the agent.
- **CMD (for testing now):** `IcpAgent.exe sign --base-url … --token … --source …`

Either way the agent: **selects the cert → POST `/api/icp/sign/prepare` (sends the
chain, gets digests) → signs each digest locally → POST `/api/icp/sign/complete`
(sends signatures).** It never downloads the PDF. `complete` runs Documenso's
normal server-side notifications, so there's no separate callback URL — the web
page just watches the document status. Auth is by the **recipient token**
(capability, same trust as the signing link); no device pairing required.

> **Security:** set `ICP_ALLOWED_ORIGIN=https://your.documenso` so the agent
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

## Build & run

```bash
./build.sh                      # Linux/macOS: javac -> build/icp-helper.jar (no Gradle/deps)
windows\build.bat               # Windows equivalent
windows\package-windows.bat     # Windows: self-contained IcpAgent.exe (jlink+jpackage, bundles a JRE)
```

```bash
# list certs
java -jar build/icp-helper.jar list --source p12 --p12 cert.p12 --password test
java -jar build/icp-helper.jar list --source windows-my

# sign (full remote flow)
java -jar build/icp-helper.jar sign --base-url https://app.documenso.com \
     --token <RECIPIENT_TOKEN> --source pkcs11 --module C:\path\token.dll
```

## Tests (need `openssl` + network for the RFC3161 TSA)

- `cli-agent.e2e.mjs` — drives the jar in `sign` CLI mode against a mock
  Documenso (real libpdf capture/embed) and verifies the agent's signature with
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
