import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { Button } from '@documenso/ui/primitives/button';
import { Trans, useLingui } from '@lingui/react/macro';
import { FileSignatureIcon, Loader2Icon, RefreshCwIcon, UploadIcon } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router';

/**
 * ICP-Brasil signing panel shown on the signing screen for `signatureLevel ===
 * 'ICP'` envelopes.
 *
 * The browser cannot reach the recipient's local A1/A3 certificate, so signing
 * is handed to the local CapivaSign agent. Two transports, tried in order:
 *
 *   1. Local HTTP agent (server mode) on http://localhost:3231 — works on any
 *      OS (incl. Linux) without registering a protocol handler. When reachable
 *      we POST the sign request straight to it.
 *   2. `documenso-icp://` deep link (protocol handler) — used when the local
 *      server isn't running.
 *
 * Either way the agent runs prepare → sign → complete against `/api/icp/sign/*`;
 * the private key never leaves the machine.
 */
const LOCAL_AGENT_URL = 'http://localhost:3231';

type SignSource = 'windows-my' | 'p12';

export const IcpSignPanel = () => {
  const { t } = useLingui();
  const params = useParams();
  const recipientToken = params.token ?? '';
  const baseUrl = NEXT_PUBLIC_WEBAPP_URL();

  const [status, setStatus] = useState<'idle' | 'working' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const buildDeepLink = (source: SignSource) =>
    `documenso-icp://sign?baseUrl=${encodeURIComponent(baseUrl)}` +
    `&token=${encodeURIComponent(recipientToken)}&source=${source}`;

  const startSigning = async (source: SignSource) => {
    if (!recipientToken) {
      return;
    }

    setStatus('working');
    setMessage(t`Conectando ao agente local…`);

    // 1) Try the local HTTP agent on the port. The connection fails fast when it
    // isn't running; if it is, this request blocks while the agent prompts for
    // the certificate/PIN and signs.
    try {
      const res = await fetch(`${LOCAL_AGENT_URL}/sign`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ baseUrl, token: recipientToken, source }),
      });
      const data = (await res.json()) as { ok?: boolean; outcome?: string; error?: string };

      if (data.ok) {
        window.location.reload();
        return;
      }

      setStatus('error');
      setMessage(data.error ?? t`Falha ao assinar pelo agente local.`);
      return;
    } catch {
      // 2) Agent not listening on the port → fall back to the deep link.
      setMessage(t`Abrindo o agente CapivaSign…`);
      window.location.href = buildDeepLink(source);
      setStatus('idle');
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="flex items-center gap-2 font-semibold text-foreground text-sm">
        <FileSignatureIcon className="h-4 w-4 text-primary" />
        <Trans>Assinatura Qualificada (ICP-Brasil)</Trans>
      </h3>

      <p className="mt-2 text-muted-foreground text-sm">
        <Trans>
          Este documento exige assinatura com certificado digital ICP-Brasil (A1 ou A3). Escolha como assinar — o agente
          CapivaSign abre na sua máquina e usa o seu certificado.
        </Trans>
      </p>

      <div className="mt-4 flex flex-col gap-2">
        <Button
          type="button"
          className="w-full"
          onClick={() => void startSigning('windows-my')}
          disabled={!recipientToken || status === 'working'}
        >
          {status === 'working' ? (
            <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileSignatureIcon className="mr-2 h-4 w-4" />
          )}
          <Trans>Certificado instalado (A3 token / A1)</Trans>
        </Button>

        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => void startSigning('p12')}
          disabled={!recipientToken || status === 'working'}
        >
          <UploadIcon className="mr-2 h-4 w-4" />
          <Trans>Arquivo .p12 / .pfx com senha (A1)</Trans>
        </Button>

        <Button type="button" variant="outline" className="w-full" onClick={() => window.location.reload()}>
          <RefreshCwIcon className="mr-2 h-4 w-4" />
          <Trans>Já assinei — atualizar</Trans>
        </Button>
      </div>

      {message && (
        <p className={`mt-3 text-xs ${status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>{message}</p>
      )}

      <p className="mt-3 text-muted-foreground text-xs">
        <Trans>
          O agente CapivaSign precisa estar em execução (porta 3231) ou com o protocolo documenso-icp:// registrado. Sua
          chave privada nunca sai da sua máquina.
        </Trans>{' '}
        <span className="text-muted-foreground/70">{t`Origem: ${baseUrl}`}</span>
      </p>
    </div>
  );
};
