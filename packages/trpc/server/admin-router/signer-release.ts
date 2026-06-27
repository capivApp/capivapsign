import { generateDatabaseId } from '@documenso/lib/universal/id';
import { getPresignGetUrl, getPresignPostUrl } from '@documenso/lib/universal/upload/server-actions';
import { prisma } from '@documenso/prisma';
import { SignerPlatform } from '@prisma/client';
import { z } from 'zod';

import { adminProcedure } from '../trpc';

const ZRelease = z.object({
  id: z.string(),
  platform: z.nativeEnum(SignerPlatform),
  version: z.string(),
  fileName: z.string(),
  createdAt: z.date(),
  downloadUrl: z.string(),
});

export const findSignerReleasesRoute = adminProcedure
  .output(z.object({ data: ZRelease.array() }))
  .query(async () => {
    const releases = await prisma.signerRelease.findMany({ orderBy: { createdAt: 'desc' } });

    const data = await Promise.all(
      releases.map(async (release) => ({
        id: release.id,
        platform: release.platform,
        version: release.version,
        fileName: release.fileName,
        createdAt: release.createdAt,
        downloadUrl: (await getPresignGetUrl(release.key)).url,
      })),
    );

    return { data };
  });

export const createSignerReleaseUploadUrlRoute = adminProcedure
  .input(z.object({ fileName: z.string().min(1), contentType: z.string().min(1) }))
  .output(z.object({ url: z.string(), key: z.string() }))
  .mutation(async ({ input }) => {
    const { url, key } = await getPresignPostUrl(input.fileName, input.contentType);

    return { url, key };
  });

export const createSignerReleaseRoute = adminProcedure
  .input(
    z.object({
      platform: z.nativeEnum(SignerPlatform),
      version: z.string().min(1),
      fileName: z.string().min(1),
      contentType: z.string().min(1),
      key: z.string().min(1),
    }),
  )
  .output(z.object({ id: z.string() }))
  .mutation(async ({ input }) => {
    const release = await prisma.signerRelease.create({
      data: {
        id: generateDatabaseId('signer_release'),
        platform: input.platform,
        version: input.version,
        fileName: input.fileName,
        contentType: input.contentType,
        key: input.key,
      },
      select: { id: true },
    });

    return { id: release.id };
  });

export const deleteSignerReleaseRoute = adminProcedure
  .input(z.object({ id: z.string() }))
  .output(z.void())
  .mutation(async ({ input }) => {
    await prisma.signerRelease.deleteMany({ where: { id: input.id } });
  });
