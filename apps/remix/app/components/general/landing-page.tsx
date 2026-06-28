import type {TClaimPricing} from '@documenso/lib/types/subscription';
import {Button} from '@documenso/ui/primitives/button';
import {Trans} from '@lingui/react/macro';
import {
    ArrowRightIcon,
    CheckCircle2Icon,
    DownloadIcon,
    FileSignatureIcon,
    MailIcon,
    MessageCircleIcon,
    PlugIcon,
    ShieldCheckIcon,
    WebhookIcon,
} from 'lucide-react';
import type {ComponentType, ReactNode} from 'react';
import {Link} from 'react-router';

import {BrandingLogo} from './branding-logo';

export type PublicPricingClaim = {
  id: string;
  name: string;
  pricing: TClaimPricing;
};

type LandingPageProps = {
  pricingClaims: PublicPricingClaim[];
};

// Localized metadata for each metered, per-item billable action. The `key`
// matches `TClaimPricing` so prices flow straight from the claims catalogue.
const PRICING_ITEMS: {
  key: keyof TClaimPricing;
  label: ReactNode;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { key: 'createDocumentCents', label: <Trans>Criação de documento</Trans>, icon: FileSignatureIcon },
  { key: 'emailMessageCents', label: <Trans>Envio de e-mail</Trans>, icon: MailIcon },
  { key: 'whatsappMessageCents', label: <Trans>Mensagem por WhatsApp</Trans>, icon: MessageCircleIcon },
  { key: 'webhookDeliveryCents', label: <Trans>Entrega de webhook</Trans>, icon: WebhookIcon },
  { key: 'recoverFileCents', label: <Trans>Recuperação de arquivo</Trans>, icon: DownloadIcon },
  { key: 'embedSessionCents', label: <Trans>Sessão de posicionador (embed)</Trans>, icon: PlugIcon },
];

const formatBrl = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const FEATURES = [
  {
    icon: ShieldCheckIcon,
    titleKey: 'icp',
    title: <Trans>Assinatura com validade jurídica</Trans>,
    description: (
      <Trans>
        Padrão ICP-Brasil (A1 e A3) e assinatura eletrônica avançada, em conformidade com a Lei nº
        14.063/2020 e o eIDAS.
      </Trans>
    ),
  },
  {
    icon: MessageCircleIcon,
    titleKey: 'whatsapp',
    title: <Trans>Solicite assinaturas por WhatsApp</Trans>,
    description: (
      <Trans>Envie o pedido de assinatura direto no WhatsApp do signatário e acompanhe em tempo real.</Trans>
    ),
  },
  {
    icon: PlugIcon,
    titleKey: 'api',
    title: <Trans>Pronto para integrar</Trans>,
    description: (
      <Trans>API e webhooks para conectar a CapivaSign aos seus sistemas, com cobrança por uso transparente.</Trans>
    ),
  },
];

const STEPS = [
  { n: 1, title: <Trans>Envie o documento</Trans>, text: <Trans>Suba o PDF e escolha os signatários.</Trans> },
  {
    n: 2,
    title: <Trans>Assine de qualquer lugar</Trans>,
    text: <Trans>Por link, e-mail ou WhatsApp — com ou sem certificado ICP-Brasil.</Trans>,
  },
  {
    n: 3,
    title: <Trans>Receba com validade jurídica</Trans>,
    text: <Trans>O documento é selado e auditável, com trilha completa de evidências.</Trans>,
  },
];

export const LandingPage = ({ pricingClaims }: LandingPageProps) => {
  return (
    <div className="bg-background text-foreground min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <BrandingLogo className="h-16 w-auto" />

          <nav className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link to="/signin">
                <Trans>Entrar</Trans>
              </Link>
            </Button>
            <Button asChild>
              <Link to="/signup">
                <Trans>Criar conta</Trans>
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-emerald-50 via-background to-background dark:from-emerald-950/30"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-emerald-400/20 blur-3xl"
        />

        <div className="mx-auto max-w-3xl px-6 pb-16 pt-20 text-center sm:pt-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            <ShieldCheckIcon className="h-3.5 w-3.5" />
            <Trans>Assinatura digital ICP-Brasil</Trans>
          </span>

          <h1 className="mt-6 text-balance text-4xl font-bold tracking-tight sm:text-6xl">
            <Trans>Assine documentos com segurança e validade jurídica</Trans>
          </h1>

          <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-balance text-lg">
            <Trans>
              A CapivaSign reúne assinatura eletrônica, ICP-Brasil e WhatsApp em uma plataforma simples,
              rápida e pronta para integrar com os seus sistemas.
            </Trans>
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link to="/signup">
                <Trans>Começar agora</Trans>
                <ArrowRightIcon className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/signin">
                <Trans>Entrar</Trans>
              </Link>
            </Button>
          </div>

          <p className="text-muted-foreground mt-6 flex items-center justify-center gap-2 text-sm">
            <CheckCircle2Icon className="h-4 w-4 text-emerald-500" />
            <Trans>Recebeu um link para assinar? Você não precisa de conta.</Trans>
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-6 sm:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.titleKey}
              className="rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-lg"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-border/60 bg-muted/30">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-center text-3xl font-bold tracking-tight">
            <Trans>Como funciona</Trans>
          </h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.n} className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-lg font-bold text-white">
                  {step.n}
                </div>
                <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      {pricingClaims.length > 0 && (
        <section id="precos" className="mx-auto max-w-6xl px-6 py-16">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              <Trans>Preços transparentes por uso</Trans>
            </h2>
            <p className="text-muted-foreground mt-4">
              <Trans>
                Você paga apenas pelo que usar. Veja o custo detalhado de cada ação cobrada — de
                webhooks a envios de mensagem.
              </Trans>
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            {pricingClaims.map((claim) => {
              const items = PRICING_ITEMS.filter(
                (item) => typeof claim.pricing[item.key] === 'number',
              );

              return (
                <div key={claim.id} className="rounded-2xl border border-border bg-card p-6">
                  <h3 className="text-lg font-semibold">{claim.name}</h3>

                  {typeof claim.pricing.monthlyPriceCents === 'number' &&
                    claim.pricing.monthlyPriceCents > 0 && (
                      <p className="mt-3">
                        <span className="text-3xl font-bold tracking-tight">
                          {formatBrl(claim.pricing.monthlyPriceCents)}
                        </span>
                        <span className="text-muted-foreground text-sm">
                          {' '}
                          <Trans>/mês + consumo de API</Trans>
                        </span>
                      </p>
                    )}

                  {items.length > 0 && (
                    <p className="text-muted-foreground mt-5 text-xs font-medium uppercase tracking-wide">
                      <Trans>Consumo por ação</Trans>
                    </p>
                  )}

                  <ul className="mt-2 divide-y divide-border/60">
                    {items.map((item) => (
                      <li key={item.key} className="flex items-center justify-between gap-4 py-3">
                        <span className="text-muted-foreground flex items-center gap-3 text-sm">
                          <item.icon className="h-4 w-4 text-emerald-500" />
                          {item.label}
                        </span>
                        <span className="text-sm font-semibold tabular-nums">
                          {formatBrl(claim.pricing[item.key] as number)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          <p className="text-muted-foreground mt-8 text-center text-xs">
            <Trans>Valores por ação, em reais. Ações não listadas não são cobradas.</Trans>
          </p>
        </section>
      )}

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <FileSignatureIcon className="mx-auto h-10 w-10 text-emerald-500" />
        <h2 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
          <Trans>Pronto para assinar com a CapivaSign?</Trans>
        </h2>
        <p className="text-muted-foreground mx-auto mt-4 max-w-xl">
          <Trans>Crie sua conta gratuitamente e envie seu primeiro documento em minutos.</Trans>
        </p>
        <div className="mt-8">
          <Button size="lg" asChild>
            <Link to="/signup">
              <Trans>Criar conta gratuita</Trans>
              <ArrowRightIcon className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <BrandingLogo className="h-9 w-auto" />
          <p className="text-muted-foreground text-xs">
            <Trans>© CapivaSign. Todos os direitos reservados.</Trans>
          </p>
        </div>
      </footer>
    </div>
  );
};
