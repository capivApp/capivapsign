import { X509Certificate } from 'node:crypto';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';

/**
 * ICP-Brasil certificate policy: parse the recipient's leaf certificate and
 * assert it is usable for signing at a given instant.
 *
 * The CPF (pessoa física) / CNPJ (pessoa jurídica) live in the certificate's
 * subjectAlternativeName as an `otherName` under ICP-Brasil OIDs:
 *   - 2.16.76.1.3.1  dadosPessoaFisica (DOB + CPF + ...)
 *   - 2.16.76.1.3.3  cnpj
 * Node's `X509Certificate` does not surface `otherName` values, so we scan the
 * raw DER for the OID and pull the adjacent digit run. When no ICP SAN is
 * present (plain test certificates) we fall back to the `CN=NAME:CPF`
 * convention used by the spike/test fixtures.
 *
 * Full chain validation to the official AC-Raiz trust anchors (and structured
 * decoding of every ICP attribute) is a Fase 5 hardening item — it needs the
 * ICP-Brasil root bundle. This module covers what signing requires: a stable
 * identity + a not-expired, signing-capable key.
 */

// DER encodings of the ICP-Brasil SAN otherName OIDs (tag 0x06, len 0x05):
//   2.16.76.1.3.1 -> 60 4C 01 03 01   (dadosPessoaFisica / CPF)
//   2.16.76.1.3.3 -> 60 4C 01 03 03   (cnpj)
const OID_PF_BYTES = Buffer.from('0605604c010301', 'hex');
const OID_CNPJ_BYTES = Buffer.from('0605604c010303', 'hex');

export type IcpKeyType = 'RSA' | 'EC';

export type IcpCertificateInfo = {
  commonName: string;
  cpfCnpj: string | null;
  issuerDn: string;
  subjectDn: string;
  serialHex: string;
  notAfter: Date;
  notBefore: Date;
  keyType: IcpKeyType;
  keyLenBits: number;
};

const decodeDer = (der: Uint8Array): X509Certificate => {
  try {
    return new X509Certificate(Buffer.from(der));
  } catch (err) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: `ICP certificate is not valid DER X.509: ${err instanceof Error ? err.message : 'unknown'}`,
    });
  }
};

const extractCommonName = (subject: string): string => {
  // node renders the subject one RDN per line, e.g. "CN=ALICE\nO=...".
  const match = subject.split('\n').find((line) => line.startsWith('CN='));
  const raw = match ? match.slice(3).trim() : subject;
  const sep = raw.indexOf(':');
  return sep > 0 ? raw.slice(0, sep).trim() : raw;
};

const cpfCnpjFromDer = (der: Uint8Array): string | null => {
  const buf = Buffer.from(der);
  for (const oid of [OID_PF_BYTES, OID_CNPJ_BYTES]) {
    const at = buf.indexOf(oid);
    if (at < 0) {
      continue;
    }
    // After the OID comes the ICP attribute content; the CPF/CNPJ is the first
    // run of 11+ digits. Scan a bounded window to avoid matching unrelated
    // digits elsewhere in the cert.
    const window = buf.subarray(at, Math.min(buf.length, at + 128)).toString('latin1');
    const digits = window.match(/\d{11,14}/);
    if (digits) {
      return digits[0];
    }
  }
  return null;
};

const cpfCnpjFromCn = (subject: string): string | null => {
  const match = subject.match(/CN=[^\n]*:(\d{11,14})\b/);
  return match ? match[1] : null;
};

const keyDetails = (cert: X509Certificate): { keyType: IcpKeyType; keyLenBits: number } => {
  const key = cert.publicKey;
  const details = key.asymmetricKeyDetails ?? {};
  if (key.asymmetricKeyType === 'rsa' || key.asymmetricKeyType === 'rsa-pss') {
    return { keyType: 'RSA', keyLenBits: details.modulusLength ?? 2048 };
  }
  if (key.asymmetricKeyType === 'ec') {
    // P-256/384/521 — map the named curve to its field size.
    const curve = details.namedCurve ?? '';
    const bits = curve.includes('521') ? 521 : curve.includes('384') ? 384 : 256;
    return { keyType: 'EC', keyLenBits: bits };
  }
  throw new AppError(AppErrorCode.INVALID_REQUEST, {
    message: `Unsupported ICP key algorithm: ${key.asymmetricKeyType ?? 'unknown'}`,
  });
};

/** Parse a DER leaf certificate into the identity + key facts signing needs. */
export const parseIcpCertificate = (der: Uint8Array): IcpCertificateInfo => {
  const cert = decodeDer(der);
  const { keyType, keyLenBits } = keyDetails(cert);

  return {
    commonName: extractCommonName(cert.subject),
    cpfCnpj: cpfCnpjFromDer(der) ?? cpfCnpjFromCn(cert.subject),
    issuerDn: cert.issuer.replace(/\n/g, ', '),
    subjectDn: cert.subject.replace(/\n/g, ', '),
    serialHex: cert.serialNumber.toLowerCase(),
    notAfter: new Date(cert.validTo),
    notBefore: new Date(cert.validFrom),
    keyType,
    keyLenBits,
  };
};

/**
 * Assert the certificate is usable to sign at `signingTime`. Throws
 * `INVALID_REQUEST` when expired/not-yet-valid. Trust-anchor chaining to the
 * AC-Raiz is intentionally deferred to Fase 5.
 */
export const assertSignableIcpCertificate = (info: IcpCertificateInfo, signingTime: Date): void => {
  if (signingTime < info.notBefore) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: `ICP certificate is not yet valid (notBefore ${info.notBefore.toISOString()}).`,
    });
  }
  if (signingTime > info.notAfter) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: `ICP certificate expired (notAfter ${info.notAfter.toISOString()}).`,
    });
  }
};
