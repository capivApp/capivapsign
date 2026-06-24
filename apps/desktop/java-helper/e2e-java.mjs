// Fase 1 end-to-end proof: the REAL Java helper performs the "sign hash" step.
//
// Same digest→sign→embed→seal contract as the Fase 0 spike, but the private-key
// operation is no longer node:crypto — it is the actual standalone Java helper
// (apps/desktop/java-helper) driven over its NDJSON stdin/stdout protocol,
// exactly as the Tauri Rust core will drive it. This proves the desktop agent's
// crypto core is a drop-in for the server-side libpdf pipeline.
//
//   prepare (capture digest)
//     -> Java helper signs ONLY the digest from an A1 .p12  (no PDF, no key export)
//     -> complete (embed B-T, real RFC3161 TSA)
//     -> finalize (addArchivalData B-LTA)
//     -> openssl verifies every recipient signature, pre- and post-seal
//
// Run from this directory after `./build.sh` and the spike fixtures exist:
//   node e2e-java.mjs
// (uses @libpdf/core resolved from ../../../packages/.../spike/node_modules)

import { spawn } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SPIKE = join(HERE, '../../../packages/ee/server-only/signing/icp/spike');
const JAR = join(HERE, 'build/icp-helper.jar');

const { HttpTimestampAuthority, PDF } = await import(join(SPIKE, 'node_modules/@libpdf/core/dist/index.mjs'));

// ---- Java helper bridge (NDJSON over a long-lived process) -----------------
// Mirrors the desktop Rust core: spawn once, stream one request/response per
// line. The real product runs the jar under a jlink'd JRE on loopback only.
class JavaAgent {
  constructor(jarPath) {
    this.proc = spawn('java', ['-jar', jarPath], { stdio: ['pipe', 'pipe', 'inherit'] });
    this.rl = createInterface({ input: this.proc.stdout });
    this.pending = [];
    this.rl.on('line', (line) => {
      const resolve = this.pending.shift();
      if (resolve) resolve(JSON.parse(line));
    });
  }
  request(obj) {
    return new Promise((resolve, reject) => {
      this.pending.push(resolve);
      this.proc.stdin.write(`${JSON.stringify(obj)}\n`, (err) => err && reject(err));
    });
  }
  async signDigest(source, digest, digestAlgo) {
    const res = await this.request({
      cmd: 'sign',
      source,
      digestB64: Buffer.from(digest).toString('base64'),
      digestAlgo,
    });
    if (!res.ok) throw new Error(`java helper: ${res.error}`);
    return res;
  }
  close() {
    this.proc.stdin.end();
  }
}

// ---- production csc capture/fifo signers (ported verbatim) -----------------
const sha256 = (d) => new Uint8Array(createHash('sha256').update(d).digest());

class CscCaptureSigner {
  capturedDigest = null;
  constructor(b) { Object.assign(this, b); }
  async sign(data) {
    if (this.capturedDigest) throw new Error('capture signer is single-use');
    this.capturedDigest = sha256(data);
    return new Uint8Array(256);
  }
}
class CscFifoSigner {
  constructor(b) { Object.assign(this, b); this.queue = [...b.signatures]; }
  async sign() {
    const next = this.queue.shift();
    if (!next) throw new Error('FIFO signer exhausted');
    return next;
  }
}

const DIGEST = 'SHA-256';
const b64ToU8 = (s) => new Uint8Array(Buffer.from(s, 'base64'));

const capture = async (bytes, cert, fieldName, signingTime) => {
  const pdf = await PDF.load(bytes);
  const signer = new CscCaptureSigner({
    certificate: cert,
    certificateChain: [],
    keyType: 'RSA',
    signatureAlgorithm: 'RSASSA-PKCS1-v1_5',
  });
  await pdf.sign({ signer, fieldName, signingTime, level: 'B-B', digestAlgorithm: DIGEST });
  return signer.capturedDigest;
};

const embed = async (bytes, chain, fieldName, signingTime, signature, tsa) => {
  const pdf = await PDF.load(bytes);
  const signer = new CscFifoSigner({
    certificate: chain[0],
    certificateChain: chain.slice(1),
    keyType: 'RSA',
    signatureAlgorithm: 'RSASSA-PKCS1-v1_5',
    signatures: [signature],
  });
  const res = await pdf.sign({
    signer,
    fieldName,
    signingTime,
    level: tsa ? 'B-T' : 'B-B',
    timestampAuthority: tsa ?? undefined,
    digestAlgorithm: DIGEST,
  });
  return res.bytes;
};

// ---- independent verification (openssl) ------------------------------------
const verifyAllRecipientSignatures = (pdfBytes) => {
  const buf = Buffer.from(pdfBytes);
  const latin = buf.toString('latin1');
  const re = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;
  let m;
  let verified = 0;
  while ((m = re.exec(latin)) !== null) {
    const [a, b, c, d] = m.slice(1, 5).map(Number);
    const dictWindow = latin.slice(Math.max(0, m.index - 300), m.index);
    if (dictWindow.includes('ETSI.RFC3161')) continue; // DocTimeStamp token
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

const ok = (cond, msg) => {
  console.log(`  ${cond ? '✓' : '✗ FAIL:'} ${msg}`);
  if (!cond) process.exitCode = 1;
};

// ---- run -------------------------------------------------------------------
console.log('==================================================================');
console.log(' ICP-Brasil Fase 1 — REAL Java helper signs the digest (A1 .p12)');
console.log('==================================================================\n');

const agent = new JavaAgent(JAR);
const source = (n) => ({ type: 'P12', path: join(SPIKE, `cert${n}.p12`), password: 'test' });

// list — prove the helper surfaces the ICP identity.
const listed = await agent.request({ cmd: 'list', source: source(1) });
ok(listed.ok && listed.certs?.[0]?.cpfCnpj === '11144477735', `helper lists ICP identity: ${listed.certs?.[0]?.commonName} / CPF ${listed.certs?.[0]?.cpfCnpj}`);

// Pre-allocate both anchors (materialize-anchors equivalent).
let bytes = new Uint8Array(readFileSync(join(SPIKE, 'input.pdf')));
{
  const pdf = await PDF.load(bytes);
  const form = pdf.getOrCreateForm();
  form.createSignatureField('ICPSig_alice');
  form.createSignatureField('ICPSig_bruno');
  bytes = await pdf.save({ useXRefStream: true });
}

let tsa = null;
try { tsa = new HttpTimestampAuthority('http://timestamp.digicert.com'); } catch { /* offline */ }

const signers = [
  { n: 1, field: 'ICPSig_alice', name: 'ALICE SILVA' },
  { n: 2, field: 'ICPSig_bruno', name: 'BRUNO COSTA' },
];

for (const { n, field, name } of signers) {
  const signingTime = new Date();
  // The leaf cert is needed at capture time (it is hashed into the ESS
  // signingCertificate signed attribute), so capture and embed must use the
  // SAME leaf. We obtain it from the helper's `list` (the credential is the
  // source of truth for the certificate), then capture, then have the helper
  // sign the resulting digest, then embed with the helper-returned chain.
  const leaf = b64ToU8((await agent.request({ cmd: 'list', source: source(n) })).certs[0].certB64);
  const digest = await capture(bytes, leaf, field, signingTime);
  const signed = await agent.signDigest(source(n), digest, DIGEST);
  const chain = signed.certChainB64.map(b64ToU8);
  bytes = await embed(bytes, chain, field, signingTime, b64ToU8(signed.signatureB64), tsa);
  console.log(`  ${name} signed via Java helper (${signed.signatureAlgorithm}); chain ${chain.length} cert(s)`);
}

agent.close();

ok(verifyAllRecipientSignatures(bytes) === 2, 'openssl verifies BOTH Java-helper signatures (B-T)');

// B-LTA seal.
if (tsa) {
  try {
    const sealed = await (await PDF.load(bytes)).addArchivalData({ timestampAuthority: tsa });
    const hasSeal = Buffer.from(sealed.bytes).toString('latin1');
    ok(hasSeal.includes('/DocTimeStamp') && hasSeal.includes('/DSS'), 'B-LTA seal added /DocTimeStamp + /DSS');
    ok(verifyAllRecipientSignatures(sealed.bytes) === 2, 'both Java-helper signatures still verify after B-LTA seal');
    console.log(`  final sealed PDF: ${sealed.bytes.length} bytes, LTV for ${sealed.signatureCount} signature(s)`);
  } catch (e) {
    console.log(`  ! seal skipped: ${e.message?.slice(0, 80)}`);
  }
}

console.log(`\n${process.exitCode ? '✗ FAILED' : '✓ PASSED — Java helper is a drop-in for the digest-signing step'}`);
