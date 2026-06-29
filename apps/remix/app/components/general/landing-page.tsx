import type { TClaimPricing } from '@documenso/lib/types/subscription';
import { Button } from '@documenso/ui/primitives/button';
import { Trans } from '@lingui/react/macro';
import {
  ArrowRightIcon,
  BadgeDollarSignIcon,
  Building2Icon,
  CheckCircle2Icon,
  CheckIcon,
  DownloadIcon,
  FileSignatureIcon,
  GaugeIcon,
  HeadphonesIcon,
  LayersIcon,
  LeafIcon,
  MailIcon,
  MessageCircleIcon,
  MinusIcon,
  PlugIcon,
  RocketIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserIcon,
  WebhookIcon,
} from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { Link } from 'react-router';

import { BrandingLogo } from './branding-logo';

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

const formatBrl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Presentation metadata for the customer-facing plans. Prices flow from the
// claims catalogue (DB); copy, icons and comparison values live here. Plans are
// keyed by their lowercased claim `name` and rendered in `PLAN_ORDER`. Internal
// claims (e.g. Platform/Teams) without an entry here stay off the public page.
type PlanFeatureValue = boolean | ReactNode;

type PlanMeta = {
  icon: ComponentType<{ className?: string }>;
  tagline: ReactNode;
  popular?: boolean;
  cta: { label: ReactNode; to?: string; href?: string; variant: 'default' | 'outline' };
  features: Record<string, PlanFeatureValue>;
};

const PLAN_ORDER = ['free', 'individual', 'early adopter', 'enterprise'];

const PLAN_META: Record<string, PlanMeta> = {
  free: {
    icon: LeafIcon,
    tagline: <Trans>Para testes e projetos pessoais</Trans>,
    cta: { label: <Trans>Começar grátis</Trans>, to: '/signup', variant: 'outline' },
    features: {
      apiFull: true,
      emailSupport: true,
      webhooks: '10/mês',
      environments: '1',
      logs: '7 dias',
      sla: false,
      prioritySupport: false,
      accountManager: false,
      onboarding: false,
    },
  },
  individual: {
    icon: UserIcon,
    tagline: <Trans>Perfeito para desenvolvedores individuais</Trans>,
    cta: { label: <Trans>Assinar plano</Trans>, to: '/signup', variant: 'outline' },
    features: {
      apiFull: true,
      emailSupport: true,
      webhooks: '50/mês',
      environments: '2',
      logs: '14 dias',
      sla: false,
      prioritySupport: false,
      accountManager: false,
      onboarding: false,
    },
  },
  'early adopter': {
    icon: RocketIcon,
    tagline: <Trans>Para startups e produtos em crescimento</Trans>,
    popular: true,
    cta: { label: <Trans>Assinar plano</Trans>, to: '/signup', variant: 'default' },
    features: {
      apiFull: true,
      emailSupport: true,
      webhooks: '500/mês',
      environments: '5',
      logs: '30 dias',
      sla: '99,5%',
      prioritySupport: true,
      accountManager: false,
      onboarding: false,
    },
  },
  enterprise: {
    icon: Building2Icon,
    tagline: <Trans>Para empresas com alta demanda</Trans>,
    cta: { label: <Trans>Falar com vendas</Trans>, href: 'mailto:contato@capivapp.com.br', variant: 'outline' },
    features: {
      apiFull: true,
      emailSupport: true,
      webhooks: <Trans>Ilimitado</Trans>,
      environments: <Trans>Ilimitado</Trans>,
      logs: '90 dias',
      sla: '99,9%',
      prioritySupport: true,
      accountManager: true,
      onboarding: true,
    },
  },
};

// Rows of the "what's included" comparison table. Values are pulled from each
// plan's `features` map above by `key` (boolean → check/dash, string → text).
const COMPARISON_ROWS: { key: string; icon: ComponentType<{ className?: string }>; label: ReactNode }[] = [
  { key: 'apiFull', icon: PlugIcon, label: <Trans>Acesso à API completa</Trans> },
  { key: 'emailSupport', icon: MailIcon, label: <Trans>Suporte via e-mail</Trans> },
  { key: 'webhooks', icon: WebhookIcon, label: <Trans>Webhooks</Trans> },
  { key: 'environments', icon: LayersIcon, label: <Trans>Ambientes (sandbox/produção)</Trans> },
  { key: 'logs', icon: ScrollTextIcon, label: <Trans>Logs de requisições</Trans> },
  { key: 'sla', icon: GaugeIcon, label: <Trans>SLA</Trans> },
  { key: 'prioritySupport', icon: HeadphonesIcon, label: <Trans>Suporte prioritário</Trans> },
  { key: 'accountManager', icon: UserIcon, label: <Trans>Gerente de conta dedicado</Trans> },
  { key: 'onboarding', icon: SparklesIcon, label: <Trans>Customizações e onboarding</Trans> },
];

const TRUST_HIGHLIGHTS = [
  {
    icon: BadgeDollarSignIcon,
    title: <Trans>Sem taxas escondidas</Trans>,
    text: <Trans>Você paga apenas pelo que usar.</Trans>,
  },
  {
    icon: LayersIcon,
    title: <Trans>Escale com facilidade</Trans>,
    text: <Trans>Troque de plano quando precisar, sem burocracia.</Trans>,
  },
  {
    icon: ShieldCheckIcon,
    title: <Trans>Infraestrutura segura</Trans>,
    text: <Trans>Seus dados protegidos com criptografia e alta disponibilidade.</Trans>,
  },
  {
    icon: HeadphonesIcon,
    title: <Trans>Suporte que entende</Trans>,
    text: <Trans>Equipe técnica pronta para te ajudar a qualquer momento.</Trans>,
  },
];

const renderFeatureValue = (value: PlanFeatureValue | undefined) => {
  if (value === true) {
    return <CheckIcon className="mx-auto h-4 w-4 text-emerald-500" />;
  }

  if (value === false || value === undefined) {
    return <MinusIcon className="mx-auto h-4 w-4 text-muted-foreground/50" />;
  }

  return <span className="font-medium text-sm">{value}</span>;
};

const FEATURES = [
  {
    icon: ShieldCheckIcon,
    titleKey: 'icp',
    title: <Trans>Assinatura com validade jurídica</Trans>,
    description: (
      <Trans>
        Padrão ICP-Brasil (A1 e A3) e assinatura eletrônica avançada, em conformidade com a Lei nº 14.063/2020 e o
        eIDAS.
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
  // Curate the public, customer-facing plans in display order. Claims without a
  // `PLAN_META` entry (internal/legacy) are intentionally excluded.
  const curatedPlans = PLAN_ORDER.flatMap((key) => {
    const claim = pricingClaims.find((item) => item.name.trim().toLowerCase() === key);
    const meta = PLAN_META[key];

    return claim && meta ? [{ claim, meta }] : [];
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-border/60 border-b bg-background/80 backdrop-blur">
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

        <div className="mx-auto max-w-3xl px-6 pt-20 pb-16 text-center sm:pt-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-medium text-emerald-700 text-xs dark:text-emerald-300">
            <ShieldCheckIcon className="h-3.5 w-3.5" />
            <Trans>Assinatura digital ICP-Brasil</Trans>
          </span>

          <h1 className="mt-6 text-balance font-bold text-4xl tracking-tight sm:text-6xl">
            <Trans>Assine documentos com segurança e validade jurídica</Trans>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
            <Trans>
              A CapivaSign reúne assinatura eletrônica, ICP-Brasil e WhatsApp em uma plataforma simples, rápida e pronta
              para integrar com os seus sistemas.
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

          <p className="mt-6 flex items-center justify-center gap-2 text-muted-foreground text-sm">
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
              <h3 className="mt-4 font-semibold text-lg">{feature.title}</h3>
              <p className="mt-2 text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-border/60 border-y bg-muted/30">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-center font-bold text-3xl tracking-tight">
            <Trans>Como funciona</Trans>
          </h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.n} className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 font-bold text-lg text-white">
                  {step.n}
                </div>
                <h3 className="mt-4 font-semibold text-lg">{step.title}</h3>
                <p className="mt-2 text-muted-foreground text-sm">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      {curatedPlans.length > 0 && (
        <section id="precos" className="relative overflow-hidden border-border/60 border-y">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-32 -z-10 mx-auto h-72 w-[42rem] rounded-full bg-emerald-400/10 blur-3xl"
          />

          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="mx-auto max-w-2xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-medium text-emerald-700 text-xs uppercase tracking-wide dark:text-emerald-300">
                <SparklesIcon className="h-3.5 w-3.5" />
                <Trans>Preços simples e transparentes</Trans>
              </span>

              <h2 className="mt-6 text-balance font-bold text-4xl tracking-tight sm:text-5xl">
                <Trans>
                  Escolha o{' '}
                  <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                    plano ideal
                  </span>{' '}
                  para o seu projeto
                </Trans>
              </h2>

              <p className="mt-4 text-balance text-lg text-muted-foreground">
                <Trans>
                  Pague apenas pelo que usar. Veja o custo detalhado de cada ação cobrada — de webhooks a envios de
                  mensagem.
                </Trans>
              </p>
            </div>

            <div className="mt-14 grid items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {curatedPlans.map(({ claim, meta }) => {
                const items = PRICING_ITEMS.filter((item) => typeof claim.pricing[item.key] === 'number');
                const Icon = meta.icon;
                const isPopular = meta.popular ?? false;

                return (
                  <div
                    key={claim.id}
                    className={`relative flex flex-col rounded-2xl p-6 transition-all ${
                      isPopular
                        ? 'border-2 border-emerald-500/70 bg-gradient-to-b from-emerald-500/10 to-card shadow-emerald-500/10 shadow-xl lg:-mt-4 lg:mb-4'
                        : 'border border-border bg-card hover:border-emerald-500/40 hover:shadow-lg'
                    }`}
                  >
                    {isPopular && (
                      <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-emerald-500 px-3 py-1 font-semibold text-[11px] text-white uppercase tracking-wide shadow">
                        <SparklesIcon className="h-3 w-3" />
                        <Trans>Mais popular</Trans>
                      </span>
                    )}

                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                        isPopular
                          ? 'bg-emerald-500 text-white'
                          : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>

                    <h3 className="mt-4 font-semibold text-xl">{claim.name}</h3>
                    <p className="mt-1 min-h-[2.5rem] text-muted-foreground text-sm leading-snug">{meta.tagline}</p>

                    <div className="mt-5">
                      <span className="font-bold text-3xl tracking-tight">
                        {formatBrl(claim.pricing.monthlyPriceCents ?? 0)}
                      </span>
                      <span className="text-muted-foreground text-sm">
                        {' '}
                        <Trans>/mês</Trans>
                      </span>
                      <p className="mt-0.5 text-muted-foreground text-xs">
                        <Trans>+ consumo de API</Trans>
                      </p>
                    </div>

                    <Button variant={meta.cta.variant} className="mt-6 w-full" asChild>
                      {meta.cta.href ? (
                        <a href={meta.cta.href}>{meta.cta.label}</a>
                      ) : (
                        <Link to={meta.cta.to ?? '/signup'}>{meta.cta.label}</Link>
                      )}
                    </Button>

                    {items.length > 0 && (
                      <p className="mt-6 font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
                        <Trans>Consumo por ação</Trans>
                      </p>
                    )}

                    <ul className="mt-2 divide-y divide-border/60">
                      {items.map((item) => (
                        <li key={item.key} className="flex items-center justify-between gap-3 py-2.5">
                          <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
                            <item.icon className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                            {item.label}
                          </span>
                          <span className="font-semibold text-[13px] tabular-nums">
                            {formatBrl(claim.pricing[item.key] as number)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            {/* Feature comparison */}
            <div className="mt-20 text-center">
              <h3 className="font-bold text-2xl tracking-tight sm:text-3xl">
                <Trans>Recursos incluídos em cada plano</Trans>
              </h3>
              <p className="mt-3 text-muted-foreground">
                <Trans>Compare os principais recursos disponíveis em cada plano.</Trans>
              </p>
            </div>

            <div className="mt-10 overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead>
                  <tr className="border-border border-b">
                    <th className="px-5 py-4 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                      <Trans>Recursos</Trans>
                    </th>
                    {curatedPlans.map(({ claim, meta }) => (
                      <th
                        key={claim.id}
                        className={`px-4 py-4 text-center font-semibold text-xs uppercase tracking-wide ${
                          meta.popular ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'
                        }`}
                      >
                        {claim.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((row) => (
                    <tr key={row.key} className="border-border/50 border-b last:border-0">
                      <td className="px-5 py-3.5">
                        <span className="flex items-center gap-2.5 text-muted-foreground text-sm">
                          <row.icon className="h-4 w-4 shrink-0 text-emerald-500" />
                          {row.label}
                        </span>
                      </td>
                      {curatedPlans.map(({ claim, meta }) => (
                        <td
                          key={claim.id}
                          className={`px-4 py-3.5 text-center ${meta.popular ? 'bg-emerald-500/[0.04]' : ''}`}
                        >
                          {renderFeatureValue(meta.features[row.key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-6 text-center text-muted-foreground text-xs">
              <Trans>Valores por ação, em reais. Ações não listadas não são cobradas.</Trans>
            </p>

            {/* Trust highlights */}
            <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
              {TRUST_HIGHLIGHTS.map((highlight, index) => (
                <div key={index} className="bg-card p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <highlight.icon className="h-5 w-5" />
                  </div>
                  <h4 className="mt-4 font-semibold text-sm">{highlight.title}</h4>
                  <p className="mt-1 text-muted-foreground text-sm leading-relaxed">{highlight.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <FileSignatureIcon className="mx-auto h-10 w-10 text-emerald-500" />
        <h2 className="mt-6 font-bold text-3xl tracking-tight sm:text-4xl">
          <Trans>Pronto para assinar com a CapivaSign?</Trans>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
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
      <footer className="border-border/60 border-t">
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
