import { prisma } from '@documenso/prisma';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getPresignGetUrl } from '../../universal/upload/server-actions';
import { getPublicSignerReleases } from './get-public-signer-releases';

vi.mock('@documenso/prisma', () => ({
  prisma: { signerRelease: { findMany: vi.fn() } },
}));

vi.mock('../../universal/upload/server-actions', () => ({
  getPresignGetUrl: vi.fn(),
}));

const release = (id: string, platform: string, version: string) => ({
  id,
  platform,
  version,
  fileName: `CapivaSign-${version}.exe`,
  key: `key/${id}`,
});

beforeEach(() => {
  // Newest first, as the query orders by createdAt desc.
  vi.mocked(prisma.signerRelease.findMany).mockResolvedValue([
    release('win_2', 'WINDOWS', '1.1.0'),
    release('linux_1', 'LINUX', '1.0.0'),
    release('win_1', 'WINDOWS', '1.0.0'),
  ] as never);

  vi.mocked(getPresignGetUrl).mockImplementation(async (key: string) => ({ key, url: `https://storage/${key}` }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getPublicSignerReleases', () => {
  it('lists the newest release of each platform with a download URL', async () => {
    const releases = await getPublicSignerReleases();

    expect(releases).toEqual([
      {
        id: 'win_2',
        platform: 'WINDOWS',
        version: '1.1.0',
        fileName: 'CapivaSign-1.1.0.exe',
        downloadUrl: 'https://storage/key/win_2',
      },
      {
        id: 'linux_1',
        platform: 'LINUX',
        version: '1.0.0',
        fileName: 'CapivaSign-1.0.0.exe',
        downloadUrl: 'https://storage/key/linux_1',
      },
    ]);
  });

  it('logs the storage error instead of hiding a release silently', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const storageError = new Error('Invalid object storage transport');
    vi.mocked(getPresignGetUrl).mockRejectedValue(storageError);

    const releases = await getPublicSignerReleases();

    expect(releases).toEqual([]);
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('win_2'), storageError);
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('linux_1'), storageError);
  });
});
