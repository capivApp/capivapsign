import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@documenso/ui/primitives/select';
import { SpinnerBox } from '@documenso/ui/primitives/spinner';
import { useToast } from '@documenso/ui/primitives/use-toast';
import type { SignerPlatform } from '@prisma/client';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { DateTime } from 'luxon';
import { useState } from 'react';

import { SettingsHeader } from '~/components/general/settings-header';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags(msg`Signer Releases`);
}

const PLATFORMS: { value: SignerPlatform; label: string }[] = [
  { value: 'WINDOWS', label: 'Windows' },
  { value: 'MACOS', label: 'macOS' },
  { value: 'LINUX', label: 'Linux' },
];

export default function AdminSignerReleasesPage() {
  const { t, i18n } = useLingui();
  const { toast } = useToast();

  const [platform, setPlatform] = useState<SignerPlatform>('WINDOWS');
  const [version, setVersion] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data, isLoading, refetch } = trpc.admin.signerRelease.find.useQuery();
  const { mutateAsync: createUploadUrl } = trpc.admin.signerRelease.createUploadUrl.useMutation();
  const { mutateAsync: createRelease } = trpc.admin.signerRelease.create.useMutation();
  const { mutateAsync: deleteRelease, isPending: isDeleting } = trpc.admin.signerRelease.delete.useMutation();

  const releases = data?.data ?? [];

  const onUpload = async () => {
    if (!file || !version.trim()) {
      return;
    }

    setIsUploading(true);

    try {
      const contentType = file.type || 'application/octet-stream';

      // 1) Presigned URL → 2) browser uploads the binary directly to storage →
      // 3) record the release.
      const { url, key } = await createUploadUrl({ fileName: file.name, contentType });

      const put = await fetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': contentType } });

      if (!put.ok) {
        throw new Error(`Upload failed (${put.status})`);
      }

      await createRelease({ platform, version, fileName: file.name, contentType, key });

      toast({ title: t`Release uploaded` });
      setFile(null);
      setVersion('');
      void refetch();
    } catch (err) {
      toast({
        title: t`Upload failed`,
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <SettingsHeader
        title={t`Signer Releases`}
        subtitle={t`Upload the CapivaSign Java signer builds. Users download these from the public download page and the signing page. Requires S3 storage.`}
      />

      <div className="space-y-4 rounded-lg border p-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">
              <Trans>Platform</Trans>
            </Label>
            <Select value={platform} onValueChange={(v) => setPlatform(v as SignerPlatform)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">
              <Trans>Version</Trans>
            </Label>
            <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.0.0" />
          </div>
        </div>

        <div>
          <Label className="text-xs">
            <Trans>Installer file</Trans>
          </Label>
          <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>

        <div className="flex justify-end">
          <Button loading={isUploading} disabled={!file || !version.trim()} onClick={onUpload}>
            <Trans>Upload</Trans>
          </Button>
        </div>
      </div>

      <h4 className="mt-8 text-base font-medium">
        <Trans>Uploaded releases</Trans>
      </h4>

      {isLoading ? (
        <SpinnerBox />
      ) : releases.length === 0 ? (
        <p className="mt-2 text-sm italic text-muted-foreground">
          <Trans>No releases yet.</Trans>
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-y-3">
          {releases.map((release) => (
            <div key={release.id} className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="text-sm font-medium">
                  {release.platform} · v{release.version}
                </p>
                <p className="text-muted-foreground text-xs">
                  {release.fileName} · {i18n.date(release.createdAt, DateTime.DATETIME_MED)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href={release.downloadUrl} download>
                    <Trans>Download</Trans>
                  </a>
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  loading={isDeleting}
                  onClick={async () => {
                    await deleteRelease({ id: release.id }).catch(() => undefined);
                    void refetch();
                  }}
                >
                  <Trans>Delete</Trans>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
