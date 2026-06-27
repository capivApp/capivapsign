import * as fs from 'node:fs';
import { getSigningCertificateMaterial } from '@documenso/lib/server-only/cert/signing-certificate';
import { env } from '@documenso/lib/utils/env';
import { P12Signer } from '@libpdf/core';

const loadP12FromEnv = (): Uint8Array => {
  const localFileContents = env('NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS');

  if (localFileContents) {
    return Buffer.from(localFileContents, 'base64');
  }

  const localFilePath = env('NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH');

  if (localFilePath) {
    return fs.readFileSync(localFilePath);
  }

  if (env('NODE_ENV') !== 'production') {
    return fs.readFileSync('./example/cert.p12');
  }

  throw new Error('No certificate found for local signing');
};

export const createLocalSigner = async () => {
  // Prefer the admin-uploaded certificate (encrypted in the DB) when present;
  // otherwise fall back to the env/file certificate + env passphrase.
  const stored = await getSigningCertificateMaterial().catch(() => null);

  if (stored) {
    return await P12Signer.create(stored.data, stored.passphrase, { buildChain: true });
  }

  const p12 = loadP12FromEnv();

  return await P12Signer.create(p12, env('NEXT_PRIVATE_SIGNING_PASSPHRASE') || '', {
    buildChain: true,
  });
};
