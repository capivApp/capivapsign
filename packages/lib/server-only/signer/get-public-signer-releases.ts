import type { SignerPlatform } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { getPresignGetUrl } from '../../universal/upload/server-actions';

export type PublicSignerRelease = {
  id: string;
  platform: SignerPlatform;
  version: string;
  fileName: string;
  downloadUrl: string;
};

/**
 * Public list of the latest CapivaSign signer build per platform, with a
 * presigned download URL. Used by the public download page and the ICP signing
 * panel (recipients may not be authenticated). Best-effort: a release whose URL
 * cannot be signed is skipped.
 */
export const getPublicSignerReleases = async (): Promise<PublicSignerRelease[]> => {
  const releases = await prisma.signerRelease.findMany({ orderBy: { createdAt: 'desc' } });

  // Keep only the newest release per platform.
  const latestByPlatform = new Map<SignerPlatform, (typeof releases)[number]>();
  for (const release of releases) {
    if (!latestByPlatform.has(release.platform)) {
      latestByPlatform.set(release.platform, release);
    }
  }

  const result = await Promise.all(
    Array.from(latestByPlatform.values()).map(async (release) => {
      try {
        const { url } = await getPresignGetUrl(release.key);

        return {
          id: release.id,
          platform: release.platform,
          version: release.version,
          fileName: release.fileName,
          downloadUrl: url,
        };
      } catch {
        return null;
      }
    }),
  );

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return result.filter((release): release is PublicSignerRelease => release !== null);
};
