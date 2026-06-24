// End-to-end test of the STANDALONE AGENT (CLI invocation) — the "no desktop
// app" flow the product will trigger via a documenso-icp:// deep link.
//
// Spins up a mock Documenso that implements /api/icp/sign/{prepare,complete}
// with the real libpdf capture/embed crypto, then drives the actual jar:
//
//   java -jar icp-helper.jar sign --base-url http://127.0.0.1:PORT \
//        --token <recipientToken> --source p12 --p12 cert1.p12 --password test
//
// Asserts the agent selected the cert, exchanged digests for signatures over
// HTTP, and that the server-side embedded PDF verifies with openssl.

import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '../../..');
const SPIKE = join(REPO, 'packages/ee/server-only/signing/icp/spike');
const JAR = join(HERE, 'build/icp-helper.jar');
const INPUT_PDF = join(REPO, 'assets/a4-size.pdf');
const TSA_URL = 'http://timestamp.digicert.com';

const { HttpTimestampAuthority, PDF } = await import(join(SPIKE, 'node_modules/@libpdf/core/dist/index.mjs'));
const { createHash } = await import('node:crypto');

const sha256 = (d) => new Uint8Array(createHash('sha256').update(d).digest());
const b64ToU8 = (s) => new Uint8Array(Buffer.from(s, 'base64'));

// minimal capture/embed (same contract as the production icp module).
class Capture {
  capturedDigest = null;
  constructor(b) { Object.assign(this, b); }
  async sign(d) { this.capturedDigest = sha256(d); return new Uint8Array(256); }
}
class Fifo {
  constructor(b) { Object.assign(this, b); this.q = [...b.signatures]; }
  async sign() { return this.q.shift(); }
}

if (existsSync(SPIKE + '/cert1.p12') === false) {
  execFileSync('bash', [join(SPIKE, 'gen-fixtures.sh')], { stdio: 'inherit' });
}
if (!existsSync(JAR)) execFileSync('bash', [join(HERE, 'build.sh')], { stdio: 'inherit' });

const tsa = new HttpTimestampAuthority(TSA_URL);
const sessions = new Map();
let lastSealedBytes = null;

// Pre-allocate an anchor on the base document (materialize-anchors equivalent).
let baseBytes = new Uint8Array(readFileSync(INPUT_PDF));
{
  const pdf = await PDF.load(baseBytes);
  pdf.getOrCreateForm().createSignatureField('ICPSig_0');
  baseBytes = await pdf.save({ useXRefStream: true });
}

const readJson = (req) =>
  new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => resolve(JSON.parse(body || '{}')));
  });

const server = createServer(async (req, res) => {
  try {
    const body = await readJson(req);
    if (req.url === '/api/icp/sign/prepare') {
      const leaf = b64ToU8(body.certChainB64[0]);
      const signingTime = new Date();
      const pdf = await PDF.load(baseBytes);
      const cap = new Capture({ certificate: leaf, certificateChain: [], keyType: 'RSA', signatureAlgorithm: 'RSASSA-PKCS1-v1_5' });
      await pdf.sign({ signer: cap, fieldName: 'ICPSig_0', signingTime, level: 'B-B', digestAlgorithm: 'SHA-256' });
      const sessionId = `sess_${sessions.size + 1}`;
      sessions.set(sessionId, { leaf, chain: body.certChainB64.map(b64ToU8), signingTime });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        sessionId,
        items: [{ envelopeItemId: 'item_0', digestB64: Buffer.from(cap.capturedDigest).toString('base64') }],
        policy: { digestAlgo: 'SHA-256', signAlgo: 'RSASSA-PKCS1-v1_5' },
      }));
      return;
    }
    if (req.url === '/api/icp/sign/complete') {
      const s = sessions.get(body.sessionId);
      const sig = b64ToU8(body.items[0].signatureB64);
      const pdf = await PDF.load(baseBytes);
      const fifo = new Fifo({ certificate: s.chain[0], certificateChain: s.chain.slice(1), keyType: 'RSA', signatureAlgorithm: 'RSASSA-PKCS1-v1_5', signatures: [sig] });
      const r = await pdf.sign({ signer: fifo, fieldName: 'ICPSig_0', signingTime: s.signingTime, level: 'B-T', timestampAuthority: tsa, digestAlgorithm: 'SHA-256' });
      lastSealedBytes = r.bytes;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ outcome: 'signed' }));
      return;
    }
    res.writeHead(404);
    res.end();
  } catch (e) {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: String(e?.message || e) }));
  }
});

const verifyLast = (pdfBytes) => {
  const buf = Buffer.from(pdfBytes);
  const latin = buf.toString('latin1');
  const m = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/.exec(latin);
  const [a, b, c, d] = m.slice(1, 5).map(Number);
  const hex = buf.subarray(a + b, c).toString('latin1').match(/<([0-9A-Fa-f]+)>/)[1];
  const dir = mkdtempSync(join(tmpdir(), 'icp-cli-'));
  writeFileSync(join(dir, 'c.bin'), Buffer.concat([buf.subarray(a, a + b), buf.subarray(c, c + d)]));
  writeFileSync(join(dir, 's.der'), Buffer.from(hex.replace(/(00)+$/, ''), 'hex'));
  execFileSync('openssl', ['cms', '-verify', '-binary', '-inform', 'DER', '-in', join(dir, 's.der'), '-content', join(dir, 'c.bin'), '-noverify', '-out', '/dev/null'], { stdio: ['ignore', 'pipe', 'pipe'] });
};

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;

console.log('==================================================================');
console.log(' ICP-Brasil — standalone agent CLI invocation (no desktop app)');
console.log('==================================================================\n');
console.log(`  mock Documenso on http://127.0.0.1:${port}`);

// Async spawn (NOT spawnSync) so the in-process mock server's event loop stays
// free to answer the agent's HTTP calls.
const run = await new Promise((resolve) => {
  const child = spawn('java', [
    '-jar', JAR, 'sign',
    '--base-url', `http://127.0.0.1:${port}`,
    '--token', 'recipient-token-abc',
    '--source', 'p12',
    '--p12', join(SPIKE, 'cert1.p12'),
    '--password', 'test',
  ], { encoding: 'utf8' });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => (stdout += d));
  child.stderr.on('data', (d) => (stderr += d));
  child.on('close', (status) => resolve({ status, stdout, stderr }));
});

server.close();

let fail = 0;
const ok = (c, m) => { console.log(`  ${c ? '✓' : '✗ FAIL:'} ${m}`); if (!c) fail++; };

process.stderr.write(run.stderr || '');
ok(run.status === 0, `agent exited 0 (status ${run.status})`);
const out = (() => { try { return JSON.parse((run.stdout || '').trim().split('\n').pop()); } catch { return {}; } })();
ok(out.ok === true && out.outcome === 'signed', `agent reported outcome=${out.outcome}`);
ok(lastSealedBytes !== null, 'server received and embedded the agent signature');
if (lastSealedBytes) {
  try { verifyLast(lastSealedBytes); ok(true, 'openssl verifies the agent-produced signature on the server PDF'); }
  catch (e) { ok(false, `openssl verify failed: ${(e.stderr?.toString() || e.message || '').split('\n')[0]}`); }
}

console.log(`\n${fail ? '✗ FAILED' : '✓ PASSED — CMD-invoked agent signs end to end over HTTP (deep-link ready)'}`);
process.exit(fail ? 1 : 0);
