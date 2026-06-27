import { prisma } from '@documenso/prisma';

import { DOCUMENSO_ENCRYPTION_SECONDARY_KEY } from '../../constants/crypto';
import { generateDatabaseId } from '../../universal/id';
import { symmetricDecrypt, symmetricEncrypt } from '../../universal/crypto';

/**
 * System-wide default signing certificate (PAdES local / non-ICP), stored with
 * BOTH the .p12 bytes and the passphrase encrypted at rest using the symmetric
 * secondary key. Effectively a singleton: an upload replaces any existing row.
 */

const requireKey = () => {
  if (!DOCUMENSO_ENCRYPTION_SECONDARY_KEY) {
    throw new Error('Missing encryption key (DOCUMENSO_ENCRYPTION_SECONDARY_KEY)');
  }

  return DOCUMENSO_ENCRYPTION_SECONDARY_KEY;
};

export type SigningCertificateMeta = {
  fileName: string;
  hasPassword: boolean;
  updatedAt: Date;
};

/** Non-secret metadata for the admin UI. Never returns the cert or password. */
export const getSigningCertificateMeta = async (): Promise<SigningCertificateMeta | null> => {
  const row = await prisma.signingCertificate.findFirst({ orderBy: { updatedAt: 'desc' } });

  if (!row) {
    return null;
  }

  let hasPassword = false;

  try {
    hasPassword = decryptToString(row.encryptedPassword).length > 0;
  } catch {
    hasPassword = false;
  }

  return { fileName: row.fileName, hasPassword, updatedAt: row.updatedAt };
};

/**
 * Decrypted material for the signer. Returns null when no certificate is set so
 * the caller falls back to the env/file certificate.
 */
export const getSigningCertificateMaterial = async (): Promise<{
  data: Uint8Array;
  passphrase: string;
} | null> => {
  const row = await prisma.signingCertificate.findFirst({ orderBy: { updatedAt: 'desc' } });

  if (!row) {
    return null;
  }

  const base64 = decryptToString(row.encryptedData);
  const passphrase = decryptToString(row.encryptedPassword);

  return { data: new Uint8Array(Buffer.from(base64, 'base64')), passphrase };
};

/** Replaces the stored certificate. `dataBase64` is the base64 of the .p12 bytes. */
export const setSigningCertificate = async (options: {
  fileName: string;
  dataBase64: string;
  password: string;
}): Promise<void> => {
  const encryptedData = encryptString(options.dataBase64);
  const encryptedPassword = encryptString(options.password ?? '');

  await prisma.$transaction(async (tx) => {
    await tx.signingCertificate.deleteMany({});
    await tx.signingCertificate.create({
      data: {
        id: generateDatabaseId('signing_certificate'),
        fileName: options.fileName,
        encryptedData,
        encryptedPassword,
      },
    });
  });
};

export const deleteSigningCertificate = async (): Promise<void> => {
  await prisma.signingCertificate.deleteMany({});
};

// ---- crypto helpers --------------------------------------------------------

const encryptString = (value: string): string =>
  symmetricEncrypt({ key: requireKey(), data: value });

const decryptToString = (encrypted: string): string =>
  Buffer.from(symmetricDecrypt({ key: requireKey(), data: encrypted })).toString('utf-8');
