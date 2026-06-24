/**
 * ICP-Brasil Fase 1 integration test — runs the PRODUCTION icp/ module API
 * against the REAL standalone Java crypto helper, a REAL RFC3161 TSA, and
 * verifies the output with openssl (an independent, non-libpdf tool).
 *
 * It is a standalone tsx script (not vitest) because it needs the built Java
 * jar, openssl, and outbound network for the TSA — none of which belong in the
 * unit suite. Run from the repo root:
 *
 *   node_modules/.bin/tsx packages/ee/server-only/signing/icp/__tests__/digest-signing.integration.ts
 *
 * Flow (exactly the server-side prepare/complete/finalize crypto path):
 *   parseIcpCertificate -> deriveSignerAlgo
 *     -> captureItemDigest  (prepare)
 *     -> Java helper signs ONLY the digest from an A1 .p12  (desktop agent)
 *     -> embedItemSignature (complete, B-T, real TSA)
 *     -> sealArchival       (finalize, B-LTA)
 *     -> openssl verifies every recipient signature, pre- and post-seal
 */

import { execFileSync, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { HttpTimestampAuthority } from '@libpdf/core';

import { captureItemDigest, deriveSignerAlgo, embedItemSignature, sealArchival } from '../digest-signing';
import { assertSignableIcpCertificate, parseIcpCertificate } from '../icp-cert-policy';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '../../../../../..');
const JAR = join(REPO, 'apps/desktop/java-helper/build/icp-helper.jar');
const INPUT_PDF = join(REPO, 'assets/a4-size.pdf'); // has a trailer /ID (required — see spike README)
const TSA_URL = 'http://timestamp.digicert.com';

const b64ToU8 = (s: string) => new Uint8Array(Buffer.from(s, 'base64'));

let failures = 0;
const ok = (cond: boolean, msg: string) => {
  console.log(`  ${cond ? '✓' : '✗ FAIL:'} ${msg}`);
  if (!cond) failures++;
};

// ---- test fixtures (self-contained) ----------------------------------------
const setupFixtures = () => {
  const dir = mkdtempSync(join(tmpdir(), 'icp-it-'));
  const mint = (n: number, subject: string) => {
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-keyout', join(dir, `k${n}.pem`), '-out', join(dir, `c${n}.pem`), '-days', '730', '-nodes', '-subj', `/C=BR/O=ICP-Brasil Test/OU=AC Teste/CN=${subject}`], { stdio: 'ignore' });
    execFileSync('openssl', ['pkcs12', '-export', '-inkey', join(dir, `k${n}.pem`), '-in', join(dir, `c${n}.pem`), '-out', join(dir, `c${n}.p12`), '-passout', 'pass:test', '-name', `signer${n}`], { stdio: 'ignore' });
  };
  mint(1, 'ALICE SILVA:11144477735');
  mint(2, 'BRUNO COSTA:52998224725');
  return dir;
};

// ---- Java helper bridge (NDJSON; mirrors the desktop Rust core) -------------
class JavaAgent {
  private proc;
  private rl;
  private pending: ((v: any) => void)[] = [];
  constructor(jarPath: string) {
    this.proc = spawn('java', ['-jar', jarPath], { stdio: ['pipe', 'pipe', 'inherit'] });
    this.rl = createInterface({ input: this.proc.stdout! });
    this.rl.on('line', (line) => this.pending.shift()?.(JSON.parse(line)));
  }
  request(obj: unknown): Promise<any> {
    return new Promise((resolve) => {
      this.pending.push(resolve);
      this.proc.stdin!.write(`${JSON.stringify(obj)}\n`);
    });
  }
  close() {
    this.proc.stdin!.end();
  }
}

// ---- independent verification (openssl) ------------------------------------
const verifyRecipientSignatures = (pdfBytes: Uint8Array): number => {
  const buf = Buffer.from(pdfBytes);
  const latin = buf.toString('latin1');
  const re = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;
  let m: RegExpExecArray | null;
  let verified = 0;
  while ((m = re.exec(latin)) !== null) {
    const [a, b, c, d] = m.slice(1, 5).map(Number);
    if (latin.slice(Math.max(0, m.index - 300), m.index).includes('ETSI.RFC3161')) continue; // DocTimeStamp
    const hex = buf.subarray(a + b, c).toString('latin1').match(/<([0-9A-Fa-f]+)>/)?.[1];
    if (!hex) continue;
    const dir = mkdtempSync(join(tmpdir(), 'icp-v-'));
    writeFileSync(join(dir, 'c.bin'), Buffer.concat([buf.subarray(a, a + b), buf.subarray(c, c + d)]));
    writeFileSync(join(dir, 's.der'), Buffer.from(hex.replace(/(00)+$/, ''), 'hex'));
    execFileSync('openssl', ['cms', '-verify', '-binary', '-inform', 'DER', '-in', join(dir, 's.der'), '-content', join(dir, 'c.bin'), '-noverify', '-out', '/dev/null'], { stdio: ['ignore', 'pipe', 'pipe'] });
    verified++;
  }
  return verified;
};

// ---- run -------------------------------------------------------------------
const main = async () => {
  console.log('==================================================================');
  console.log(' ICP-Brasil Fase 1 — production icp/ modules + real Java helper');
  console.log('==================================================================\n');

  if (!existsSync(JAR)) {
    execFileSync('bash', [join(REPO, 'apps/desktop/java-helper/build.sh')], { stdio: 'inherit' });
  }

  const dir = setupFixtures();
  const agent = new JavaAgent(JAR);
  const source = (n: number) => ({ type: 'P12', path: join(dir, `c${n}.p12`), password: 'test' });
  const tsa = new HttpTimestampAuthority(TSA_URL);

  // Pre-allocate both anchors (materialize-anchors equivalent).
  const { PDF } = await import('@libpdf/core');
  let bytes = new Uint8Array(readFileSync(INPUT_PDF));
  {
    const pdf = await PDF.load(bytes);
    const form = pdf.getOrCreateForm();
    form.createSignatureField('ICPSig_0');
    form.createSignatureField('ICPSig_1');
    bytes = await pdf.save({ useXRefStream: true });
  }

  const signers = [
    { n: 1, field: 'ICPSig_0', expectCpf: '11144477735' },
    { n: 2, field: 'ICPSig_1', expectCpf: '52998224725' },
  ];

  for (const { n, field, expectCpf } of signers) {
    const signingTime = new Date();

    // The desktop lists certs; the leaf is the source of truth for capture.
    const listed = await agent.request({ cmd: 'list', source: source(n) });
    const leaf = b64ToU8(listed.certs[0].certB64);

    // prepare: policy + capture.
    const info = parseIcpCertificate(leaf);
    assertSignableIcpCertificate(info, signingTime);
    ok(info.cpfCnpj === expectCpf, `parsed ICP identity ${info.commonName} / CPF ${info.cpfCnpj}`);
    const algo = deriveSignerAlgo(info);

    const digest = await captureItemDigest({
      pdfBytes: bytes,
      certificate: leaf,
      certificateChain: [],
      algo,
      anchorName: field,
      signingTime,
    });

    // desktop agent signs ONLY the digest.
    const signed = await agent.request({ cmd: 'sign', source: source(n), digestB64: Buffer.from(digest).toString('base64'), digestAlgo: algo.digestAlgorithm });
    ok(signed.ok && signed.signatureAlgorithm === 'RSASSA-PKCS1-v1_5', `Java helper signed digest (${signed.signatureAlgorithm})`);
    const chain = (signed.certChainB64 as string[]).map(b64ToU8);

    // complete: embed B-T.
    bytes = await embedItemSignature({
      pdfBytes: bytes,
      certificate: chain[0],
      certificateChain: chain.slice(1),
      algo,
      anchorName: field,
      signingTime,
      signature: b64ToU8(signed.signatureB64),
      timestampAuthority: tsa,
    });
  }

  agent.close();

  ok(verifyRecipientSignatures(bytes) === 2, 'openssl verifies BOTH recipient signatures (B-T) after sequential signing');

  // finalize: B-LTA seal.
  const sealed = await sealArchival({ pdfBytes: bytes, timestampAuthority: tsa });
  const sealedLatin = Buffer.from(sealed.bytes).toString('latin1');
  ok(sealedLatin.includes('/DocTimeStamp') && sealedLatin.includes('/DSS'), 'B-LTA seal added /DocTimeStamp + /DSS');
  ok(verifyRecipientSignatures(sealed.bytes) === 2, 'both recipient signatures still verify after B-LTA seal');
  console.log(`  final sealed PDF: ${sealed.bytes.length} bytes, LTV for ${sealed.signatureCount} signature(s)`);

  console.log(`\n${failures ? `✗ FAILED (${failures})` : '✓ PASSED — production icp/ modules sign via the Java helper end to end'}`);
  process.exit(failures ? 1 : 0);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
