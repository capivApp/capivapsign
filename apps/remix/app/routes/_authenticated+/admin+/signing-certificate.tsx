import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { DateTime } from 'luxon';
import { useState } from 'react';

import { SettingsHeader } from '~/components/general/settings-header';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags(msg`Signing Certificate`);
}

/** Reads a File into base64 (strips the data: URL prefix). */
const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export default function AdminSigningCertificatePage() {
  const { t, i18n } = useLingui();
  const { toast } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');

  const { data: current, isLoading, refetch } = trpc.admin.signingCertificate.get.useQuery();
  const { mutateAsync: upload, isPending: isUploading } = trpc.admin.signingCertificate.upload.useMutation();
  const { mutateAsync: remove, isPending: isRemoving } = trpc.admin.signingCertificate.delete.useMutation();

  const onUpload = async () => {
    if (!file) {
      return;
    }

    try {
      const dataBase64 = await fileToBase64(file);

      await upload({ fileName: file.name, dataBase64, password });

      toast({ title: t`Certificate saved` });
      setFile(null);
      setPassword('');
      void refetch();
    } catch (err) {
      toast({
        title: t`Failed to save certificate`,
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    }
  };

  const onDelete = async () => {
    await remove().catch(() => undefined);
    toast({ title: t`Certificate removed` });
    void refetch();
  };

  return (
    <div className="max-w-2xl">
      <SettingsHeader
        title={t`Signing Certificate`}
        subtitle={t`Default certificate used for non-ICP (PAdES) signatures. The file and password are stored encrypted.`}
      />

      {!isLoading && current && (
        <Alert variant="neutral" className="mb-6">
          <AlertTitle>
            <Trans>Current certificate</Trans>
          </AlertTitle>
          <AlertDescription>
            <p>{current.fileName}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {current.hasPassword ? <Trans>Password set</Trans> : <Trans>No password</Trans>}
              {' · '}
              <Trans>Updated {i18n.date(current.updatedAt, DateTime.DATETIME_MED)}</Trans>
            </p>
            <Button variant="destructive" className="mt-3" loading={isRemoving} onClick={onDelete}>
              <Trans>Remove certificate</Trans>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4 rounded-lg border p-4">
        <div>
          <Label className="text-xs">
            <Trans>Certificate file (.p12 / .pfx)</Trans>
          </Label>
          <Input
            type="file"
            accept=".p12,.pfx,application/x-pkcs12"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <div>
          <Label className="text-xs">
            <Trans>Password</Trans>
          </Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t`Certificate password`}
          />
        </div>

        <div className="flex justify-end">
          <Button loading={isUploading} disabled={!file} onClick={onUpload}>
            <Trans>Save certificate</Trans>
          </Button>
        </div>
      </div>
    </div>
  );
}
