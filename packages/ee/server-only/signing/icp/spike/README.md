# ICP-Brasil — Fase 0 viability spike

Standalone, runnable proof that the **existing EE `csc/` PAdES pipeline** can be
driven by a **digest-only external signer** (the future desktop A1/A3 agent)
instead of a cloud CSC/TSP — which is the single architectural risk in the
ICP-Brasil plan. **It is not part of the app build.**

The whole plan hinges on one claim: we do **not** need a new Java/PDF signature
core, because the digest→sign→embed→archive contract the CSC flow already uses
works identically when the "sign the hash" step is performed by a local agent
holding the user's A1/A3 key. This spike proves exactly that, end to end,
against a **real RFC3161 TSA**, with **independent (non-libpdf) verification**.

## Run

```bash
cd packages/ee/server-only/signing/icp/spike
npm install        # only @libpdf/core
npm run setup      # openssl: 2 test A1 identities + an /ID-bearing input.pdf
npm run spike      # node spike.mjs   (needs outbound network for the TSA)
```

Requires `openssl` on PATH (used both to mint test certs and as the independent
signature verifier — a stand-in for Adobe / `pdfsig`, which aren't in CI).

## What it proves

**PROOF 1 — digest-only signing is sound.**
The desktop agent (here: `node:crypto` over a test P12, standing in for the Java
PKCS#11 / KeyStore helper) is handed **only the `signedAttrs` digest** that
`CscCaptureSigner` derives — never the document, never the key leaving the
device. It returns a raw signature that `CscFifoSigner` embeds. Asserted:

- the captured digest is **deterministic** across the capture and embed passes;
- `publicDecrypt(signature) === DigestInfo(digest)` — the agent signed *exactly*
  what libpdf asked for;
- `openssl cms -verify` accepts the embedded PAdES signature (RSA + the
  `messageDigest` binding to the byte-range content).

**PROOF 2 — the real target flow.**
Two recipients sign **sequentially** via the digest-only path at **PAdES B-T**
(real DigiCert RFC3161 TSA), then the document is sealed to **B-LTA** with
`pdf.addArchivalData()`. Asserted:

- both signatures land as incremental updates (2× `/ByteRange`);
- **the first signer's signature still `openssl`-verifies after the second signs**
  (the incremental-update / ByteRange invariant holds);
- the seal adds `/DocTimeStamp` + `/DSS` (PAdES-LTA), and **all recipient
  signatures still verify after sealing**.

This maps 1:1 onto the production modules to build in Fase 1
(`materialize-anchors` → `prepare` (capture) → `complete` (embed, B-T) →
`finalize` (`addArchivalData`, B-LTA)); the spike reuses the actual
`CscCaptureSigner` / `CscFifoSigner` logic verbatim.

## ⚠️ Critical finding — the input PDF must carry a trailer `/ID`

`@libpdf/core`'s `sign()` generates a **random** `/ID` when the source PDF has
none. The `/ID` lives inside the signed `ByteRange`, so a random one makes the
`signedAttrs` `messageDigest` — and therefore the captured digest —
**non-deterministic**, which silently breaks the two-pass capture/embed contract
(the digest the agent signs would not match the digest the embed pass
reconstructs).

With a stable `/ID` present, `sign()` is **fully deterministic** and the
contract holds. Real Documenso PDFs (and the `renderedBytes` persisted by
`materialize-anchors` / the `prepare` step) always carry a `/ID`, so production
is safe. The Fase 1 `prepare` step should nonetheless **assert/guarantee an
`/ID` exists** on the persisted bytes before capturing, to fail loud rather than
produce an unverifiable signature. (`assets/example.pdf` has no `/ID`;
`assets/a4-size.pdf` does — the spike uses the latter.)
