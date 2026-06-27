import { getPublicSignerReleases } from '@documenso/lib/server-only/signer/get-public-signer-releases';
import { Button } from '@documenso/ui/primitives/button';
import { Trans } from '@lingui/react/macro';
import { DownloadIcon, ShieldCheckIcon } from 'lucide-react';

import { BrandingLogo } from '~/components/general/branding-logo';

import type { Route } from './+types/signer';

export function meta() {
  return [{ title: 'CapivaSign — Baixar o assinador ICP-Brasil' }];
}

const PLATFORM_LABEL: Record<string, string> = {
  WINDOWS: 'Windows',
  MACOS: 'macOS',
  LINUX: 'Linux',
};

export async function loader() {
  const releases = await getPublicSignerReleases();

  return { releases };
}

export default function SignerDownloadPage({ loaderData }: Route.ComponentProps) {
  const releases = loaderData?.releases ?? [];

  return (
    <div className="bg-background text-foreground min-h-screen">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-4xl items-center px-6 py-4">
          <BrandingLogo className="h-8 w-auto" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          <ShieldCheckIcon className="h-3.5 w-3.5" />
          <Trans>Assinador ICP-Brasil</Trans>
        </span>

        <h1 className="mt-6 text-3xl font-bold tracking-tight">
          <Trans>Baixe o assinador CapivaSign</Trans>
        </h1>
        <p className="text-muted-foreground mt-4">
          <Trans>
            O assinador roda na sua máquina e usa o seu certificado digital ICP-Brasil (A1 ou A3) para
            assinar com validade jurídica. Sua chave privada nunca sai do seu computador.
          </Trans>
        </p>

        <div className="mt-10 space-y-3">
          {releases.length === 0 ? (
            <p className="text-muted-foreground text-sm italic">
              <Trans>Nenhum download disponível no momento.</Trans>
            </p>
          ) : (
            releases.map((release) => (
              <div
                key={release.id}
                className="flex items-center justify-between rounded-lg border border-border p-4"
              >
                <div>
                  <p className="font-medium">{PLATFORM_LABEL[release.platform] ?? release.platform}</p>
                  <p className="text-muted-foreground text-xs">
                    {release.fileName} · v{release.version}
                  </p>
                </div>
                <Button asChild>
                  <a href={release.downloadUrl} download>
                    <DownloadIcon className="mr-2 h-4 w-4" />
                    <Trans>Baixar</Trans>
                  </a>
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="mt-12 rounded-lg border border-border bg-muted/30 p-5 text-sm">
          <p className="font-medium">
            <Trans>Como usar</Trans>
          </p>
          <ol className="text-muted-foreground mt-2 list-decimal space-y-1 pl-5">
            <li>
              <Trans>Baixe e instale o assinador para o seu sistema.</Trans>
            </li>
            <li>
              <Trans>Conecte o seu token A3 ou tenha o seu certificado A1 (.p12) em mãos.</Trans>
            </li>
            <li>
              <Trans>Volte para a página de assinatura e clique em assinar com ICP-Brasil.</Trans>
            </li>
          </ol>
        </div>
      </main>
    </div>
  );
}
