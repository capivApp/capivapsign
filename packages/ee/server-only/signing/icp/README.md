# ICP-Brasil signing (`signatureLevel: 'ICP'`)

Server-side modules for ICP-Brasil digital signatures with the recipient's own
A1 (`.p12`) / A3 (token, Windows store) certificate. The PDF / PAdES / DSS / LTA
work is **the same pipeline the CSC/TSP flow uses** — this package only swaps the
"sign the hash" step from a cloud TSP call to a signature produced by the
[desktop crypto helper](../../../../../apps/desktop/java-helper). The private key
never leaves the signer's machine.

## Flow

```
send-document ──▶ materialize-anchors (shared with csc/)   pre-allocate per-recipient
                                                           signature anchors; force SEQUENTIAL
desktop ──▶ POST /api/icp/sign/prepare  ──▶ prepare-recipient-signing.ts
              certChainB64 + certType         · validate ICP cert (icp-cert-policy)
                                              · captureItemDigest per item  (digest-signing)
                                              · pin bytes + persist IcpSignSession
            ◀── { sessionId, items:[{digestB64}], policy }

desktop signs each digest locally (Java helper, A1/A3)

desktop ──▶ POST /api/icp/sign/complete ──▶ complete-recipient-signing.ts
              { sessionId, items:[{signatureB64}] }  · re-capture digest, assert == prep hash
                                                      · embedItemSignature B-T (real TSA)
                                                      · flip recipient SIGNED, audit, evidence
                                                      · schedule seal when all signed
            ◀── { outcome: 'signed' }

seal-document job ──▶ finalizeTspEnvelopeCompletion (shared)   addArchivalData ⇒ PAdES B-LTA
```

## Modules

| File | Role |
|---|---|
| `digest-signing.ts` | reusable crypto core: `captureItemDigest` / `embedItemSignature` / `sealArchival`, reusing the csc `CscCaptureSigner` / `CscFifoSigner` |
| `icp-cert-policy.ts` | parse the leaf cert (CN, CPF/CNPJ via ICP SAN OIDs + CN fallback, key facts); assert signable |
| `desktop-protocol.ts` | Zod contracts: Java helper NDJSON + the `/api/icp/sign/*` request/response shapes |
| `sign-session.ts` | `IcpSignSession` DB lifecycle (upsert/load/consume) |
| `icp-tsa.ts` | env-configured RFC3161 TSA for B-T and B-LTA |
| `prepare-recipient-signing.ts` | capture phase |
| `complete-recipient-signing.ts` | embed phase + side effects |
| `hono/` | `/api/icp/sign/{prepare,complete}` with device-token auth |

Shared with `csc/` (not duplicated): `materialize-anchors`, `pdf-names`,
`signers/*`, `tsa-resolver`, and the B-LTA seal in `finalize-tsp-completion`.
The send-time materialisation and seal handler key off
`isPadesPipelineEnvelope` (TSP ∪ ICP).

## Status (Fase 1)

The crypto core (capture → desktop-signed digest → embed B-T → B-LTA seal) is
**verified end-to-end** against the real Java helper, a real DigiCert RFC3161
TSA, and independent openssl verification — see
`__tests__/digest-signing.integration.ts`. The `@documenso/ee` package
typechecks clean. The DB-coupled prepare/complete + Hono routes are written and
typechecked; full runtime testing of those needs a live Postgres + app and lands
with the desktop app (Fase 2).

**Not yet done** (later phases): the standardised ICP visual stamp, AC-Raiz chain
validation + structured PF/PJ OID decoding (Fase 5), the desktop pairing
endpoints (`/api/icp/desktop/*`) and SSE broker, and A3/PKCS#11.

### Known follow-ups
- `prepare` does not yet render the ICP visual overlay (deferred; capture runs
  over the materialised bytes as-is).
- ICP-specific `AppErrorCode`s — currently generic `INVALID_REQUEST` with
  descriptive messages.
