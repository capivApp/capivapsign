import LogoIcon from '@documenso/assets/logo_icon.png';
import type { TClaimFlags, TClaimPricing } from '@documenso/lib/types/subscription';
import { Button } from '@documenso/ui/primitives/button';
import { Trans } from '@lingui/react/macro';
import {
  ArrowRightIcon,
  BadgeCheckIcon,
  BadgeDollarSignIcon,
  Building2Icon,
  CheckCircle2Icon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  FileSignatureIcon,
  FingerprintIcon,
  GaugeIcon,
  HeadphonesIcon,
  LayersIcon,
  LeafIcon,
  MailIcon,
  MessageCircleIcon,
  MinusIcon,
  PaletteIcon,
  PlugIcon,
  RocketIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserIcon,
  WebhookIcon,
} from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { BrandingLogo } from './branding-logo';

export type PublicPricingClaim = {
  id: string;
  name: string;
  pricing: TClaimPricing;
  flags: TClaimFlags;
};

type LandingPageProps = {
  pricingClaims: PublicPricingClaim[];
};

// Localized metadata for each metered, per-item billable action. The `key`
// matches `TClaimPricing` so prices flow straight from the claims catalogue.
const PRICING_ITEMS: {
  key: keyof TClaimPricing;
  // Matching free-allowance field; usage up to this amount each month is free.
  quotaKey: keyof TClaimPricing;
  label: ReactNode;
  icon: ComponentType<{ className?: string }>;
}[] = [
  {
    key: 'createDocumentCents',
    quotaKey: 'createDocumentFreeQuota',
    label: <Trans>Criação de documento</Trans>,
    icon: FileSignatureIcon,
  },
  {
    key: 'emailMessageCents',
    quotaKey: 'emailMessageFreeQuota',
    label: <Trans>Envio de e-mail</Trans>,
    icon: MailIcon,
  },
  {
    key: 'whatsappMessageCents',
    quotaKey: 'whatsappMessageFreeQuota',
    label: <Trans>Mensagem por WhatsApp</Trans>,
    icon: MessageCircleIcon,
  },
  {
    key: 'webhookDeliveryCents',
    quotaKey: 'webhookDeliveryFreeQuota',
    label: <Trans>Entrega de webhook</Trans>,
    icon: WebhookIcon,
  },
  {
    key: 'recoverFileCents',
    quotaKey: 'recoverFileFreeQuota',
    label: <Trans>Recuperação de arquivo</Trans>,
    icon: DownloadIcon,
  },
  {
    key: 'embedSessionCents',
    quotaKey: 'embedSessionFreeQuota',
    label: <Trans>Sessão de posicionador (embed)</Trans>,
    icon: PlugIcon,
  },
];

const formatBrl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Presentation metadata for the customer-facing plans. Prices flow from the
// claims catalogue (DB); copy, icons and comparison values live here. Plans are
// keyed by their lowercased claim `name` and rendered in `PLAN_ORDER` first,
// then any remaining priced claim is appended with `FALLBACK_PLAN_META` — so a
// claim added in admin shows up on the page as soon as it has a price, even
// without a curated entry here. Visibility is controlled by setting a price
// (see `getPublicPricingClaims`), not by this map.
type PlanFeatureValue = boolean | ReactNode;

type PlanMeta = {
  icon: ComponentType<{ className?: string }>;
  tagline: ReactNode;
  popular?: boolean;
  cta: { label: ReactNode; to?: string; href?: string; variant: 'default' | 'outline' };
  features: Record<string, PlanFeatureValue>;
};

const PLAN_ORDER = ['free', 'individual', 'early adopter', 'plataforma', 'enterprise'];

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
  plataforma: {
    icon: LayersIcon,
    tagline: <Trans>Para plataformas que assinam em escala</Trans>,
    cta: { label: <Trans>Assinar plano</Trans>, to: '/signup', variant: 'outline' },
    features: {
      apiFull: true,
      emailSupport: true,
      webhooks: '2.000/mês',
      environments: '10',
      logs: '60 dias',
      sla: '99,9%',
      prioritySupport: true,
      accountManager: true,
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

// Used for any priced claim that has no curated `PLAN_META` entry (e.g. a plan
// freshly added in admin). It still renders a real card from the DB price/flags;
// it just has no hand-written tagline or marketing-tier comparison values.
const FALLBACK_PLAN_META: PlanMeta = {
  icon: LayersIcon,
  tagline: null,
  cta: { label: <Trans>Assinar plano</Trans>, to: '/signup', variant: 'outline' },
  features: {},
};

// Comparison rows backed by the curated `PLAN_META.features` map (marketing
// tiers that don't live in the DB — webhook quotas, SLA, support level…).
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

// Comparison rows backed by the real `claim.flags` returned from the DB. These
// are capabilities (not metered prices), e.g. white-label, so they're rendered
// straight from each plan's flags — no price, but still demonstrated.
const FLAG_COMPARISON_ROWS: {
  key: keyof TClaimFlags;
  icon: ComponentType<{ className?: string }>;
  label: ReactNode;
}[] = [
  { key: 'whiteLabelBranding', icon: PaletteIcon, label: <Trans>White label (sua marca)</Trans> },
  { key: 'allowCustomBranding', icon: SparklesIcon, label: <Trans>Marca personalizada</Trans> },
  { key: 'unlimitedDocuments', icon: FileSignatureIcon, label: <Trans>Documentos ilimitados</Trans> },
  { key: 'embedSigning', icon: PlugIcon, label: <Trans>Assinatura incorporada (embed)</Trans> },
  { key: 'signingReminders', icon: MailIcon, label: <Trans>Lembretes de assinatura</Trans> },
  { key: 'cscQesSigning', icon: FingerprintIcon, label: <Trans>Assinatura qualificada (QES)</Trans> },
  { key: 'cfr21', icon: BadgeCheckIcon, label: <Trans>Conformidade 21 CFR Part 11</Trans> },
  { key: 'hipaa', icon: ShieldCheckIcon, label: <Trans>Conformidade HIPAA</Trans> },
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
    return <MinusIcon className="mx-auto h-4 w-4 text-muted-foreground/40" />;
  }

  return <span className="font-medium text-sm">{value}</span>;
};

// Cards shown in the features carousel. Richer than the previous static grid so
// the carousel has something to scroll through.
const FEATURES: {
  icon: ComponentType<{ className?: string }>;
  titleKey: string;
  title: ReactNode;
  description: ReactNode;
}[] = [
  {
    icon: ShieldCheckIcon,
    titleKey: 'icp',
    title: <Trans>Validade jurídica ICP-Brasil</Trans>,
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
    title: <Trans>Assinaturas por WhatsApp</Trans>,
    description: (
      <Trans>Envie o pedido de assinatura direto no WhatsApp do signatário e acompanhe em tempo real.</Trans>
    ),
  },
  {
    icon: PaletteIcon,
    titleKey: 'whitelabel',
    title: <Trans>White label com a sua marca</Trans>,
    description: (
      <Trans>
        Personalize páginas de assinatura, e-mails e certificados com o seu logotipo e as suas cores — sem a marca
        CapivaSign.
      </Trans>
    ),
  },
  {
    icon: PlugIcon,
    titleKey: 'api',
    title: <Trans>API e webhooks prontos</Trans>,
    description: (
      <Trans>
        Conecte a CapivaSign aos seus sistemas com API completa e webhooks, com cobrança por uso transparente.
      </Trans>
    ),
  },
  {
    icon: ScrollTextIcon,
    titleKey: 'audit',
    title: <Trans>Trilha de auditoria completa</Trans>,
    description: (
      <Trans>Cada documento é selado e auditável, com trilha de evidências detalhada de ponta a ponta.</Trans>
    ),
  },
  {
    icon: BadgeCheckIcon,
    titleKey: 'compliance',
    title: <Trans>Conformidade empresarial</Trans>,
    description: (
      <Trans>Recursos para 21 CFR Part 11, HIPAA e assinatura qualificada (QES) para times com alta exigência.</Trans>
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

const HERO_STATS = [
  { value: 'ICP-Brasil', label: <Trans>A1 e A3 nativos</Trans> },
  { value: '+ WhatsApp', label: <Trans>Assine por mensagem</Trans> },
  { value: 'API-first', label: <Trans>Integre em minutos</Trans> },
];

// Self-contained horizontal carousel (scroll-snap + arrows + dots). No extra
// dependency — uses native scrolling so it stays smooth and accessible.
const FeatureCarousel = () => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const scrollByCard = useCallback((direction: 1 | -1) => {
    const scroller = scrollerRef.current;

    if (!scroller) {
      return;
    }

    const firstCard = scroller.querySelector<HTMLElement>('[data-carousel-card]');
    const step = firstCard ? firstCard.offsetWidth + 24 : scroller.clientWidth;

    scroller.scrollBy({ left: step * direction, behavior: 'smooth' });
  }, []);

  const scrollToIndex = useCallback((index: number) => {
    const scroller = scrollerRef.current;
    const card = scroller?.querySelectorAll<HTMLElement>('[data-carousel-card]')[index];

    card?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;

    if (!scroller) {
      return;
    }

    const handleScroll = () => {
      const firstCard = scroller.querySelector<HTMLElement>('[data-carousel-card]');
      const step = firstCard ? firstCard.offsetWidth + 24 : 1;

      setActiveIndex(Math.round(scroller.scrollLeft / step));
    };

    scroller.addEventListener('scroll', handleScroll, { passive: true });

    return () => scroller.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        className="-mx-6 flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth px-6 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {FEATURES.map((feature) => (
          <article
            key={feature.titleKey}
            data-carousel-card
            className="group flex w-[85%] shrink-0 snap-start flex-col rounded-3xl border border-border bg-card p-7 transition-all hover:border-emerald-500/50 hover:shadow-emerald-500/5 hover:shadow-xl sm:w-[calc((100%-24px)/2)] lg:w-[calc((100%-48px)/3)]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 transition-colors group-hover:bg-emerald-500 group-hover:text-white dark:text-emerald-400">
              <feature.icon className="h-6 w-6" />
            </div>
            <h3 className="mt-5 font-semibold text-lg">{feature.title}</h3>
            <p className="mt-2 text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
          </article>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {FEATURES.map((feature, index) => (
            <button
              key={feature.titleKey}
              type="button"
              aria-label={`Ir para o recurso ${index + 1}`}
              onClick={() => scrollToIndex(index)}
              className={`h-2 rounded-full transition-all ${
                activeIndex === index ? 'w-6 bg-emerald-500' : 'w-2 bg-border hover:bg-emerald-500/40'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            aria-label="Recurso anterior"
            onClick={() => scrollByCard(-1)}
            className="h-10 w-10 rounded-full p-0"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            aria-label="Próximo recurso"
            onClick={() => scrollByCard(1)}
            className="h-10 w-10 rounded-full p-0"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export const LandingPage = ({ pricingClaims }: LandingPageProps) => {
  // All priced claims, in display order: curated `PLAN_ORDER` first, then any
  // remaining claim appended (alphabetical, as returned by the loader). Every
  // priced claim is shown — curated ones get their rich `PLAN_META`, the rest
  // fall back to `FALLBACK_PLAN_META`.
  const claimKey = (claim: PublicPricingClaim) => claim.name.trim().toLowerCase();
  const orderIndex = (key: string) => {
    const index = PLAN_ORDER.indexOf(key);
    return index === -1 ? PLAN_ORDER.length : index;
  };

  const curatedPlans = [...pricingClaims]
    .sort((a, b) => orderIndex(claimKey(a)) - orderIndex(claimKey(b)))
    .map((claim) => ({ claim, meta: PLAN_META[claimKey(claim)] ?? FALLBACK_PLAN_META }));

  // Only show flag rows that at least one curated plan actually enables, so the
  // comparison never lists capabilities nobody offers.
  const activeFlagRows = FLAG_COMPARISON_ROWS.filter((row) =>
    curatedPlans.some(({ claim }) => claim.flags[row.key] === true),
  );

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
          className="pointer-events-none absolute -top-32 left-1/2 -z-10 h-80 w-[42rem] -translate-x-1/2 rounded-full bg-emerald-400/20 blur-3xl"
        />

        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 pt-16 pb-20 sm:pt-24 lg:grid-cols-2">
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-medium text-emerald-700 text-xs dark:text-emerald-300">
              <ShieldCheckIcon className="h-3.5 w-3.5" />
              <Trans>Assinatura digital ICP-Brasil</Trans>
            </span>

            <h1 className="mt-6 text-balance font-bold text-4xl tracking-tight sm:text-6xl">
              <Trans>Assine documentos com segurança e validade jurídica</Trans>
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-balance text-lg text-muted-foreground lg:mx-0">
              <Trans>
                A CapivaSign reúne assinatura eletrônica, ICP-Brasil e WhatsApp em uma plataforma simples, rápida e
                pronta para integrar com os seus sistemas.
              </Trans>
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
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

            <p className="mt-6 flex items-center justify-center gap-2 text-muted-foreground text-sm lg:justify-start">
              <CheckCircle2Icon className="h-4 w-4 text-emerald-500" />
              <Trans>Recebeu um link para assinar? Você não precisa de conta.</Trans>
            </p>

            <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 border-border/60 border-t pt-6">
              {HERO_STATS.map((stat, index) => (
                <div key={index} className="text-center lg:text-left">
                  <dt className="font-bold text-emerald-600 text-lg dark:text-emerald-400">{stat.value}</dt>
                  <dd className="mt-0.5 text-muted-foreground text-xs">{stat.label}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Product mockup */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div aria-hidden className="absolute -top-6 -right-6 h-24 w-24 rounded-2xl bg-emerald-400/20 blur-2xl" />

            {/* Brand mascot peeking over the mockup */}
            <img
              src={LogoIcon}
              alt="CapivaSign"
              className="absolute -top-12 -right-5 z-10 h-24 w-24 drop-shadow-xl sm:h-28 sm:w-28"
            />

            <div className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-2xl shadow-emerald-500/5">
              <div className="flex items-center gap-1.5 border-border/60 border-b bg-muted/40 px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
                <span className="ml-3 text-muted-foreground text-xs">contrato-prestacao-servico.pdf</span>
              </div>

              <div className="space-y-3 p-6">
                <div className="h-2.5 w-2/3 rounded-full bg-muted" />
                <div className="h-2 w-full rounded-full bg-muted/70" />
                <div className="h-2 w-11/12 rounded-full bg-muted/70" />
                <div className="h-2 w-4/5 rounded-full bg-muted/70" />

                <div className="mt-6 rounded-2xl border border-emerald-500/30 border-dashed bg-emerald-500/5 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/30">
                      <img src={LogoIcon} alt="" className="h-8 w-8 object-contain" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">
                        <Trans>Assinatura coletada</Trans>
                      </div>
                      <div className="text-muted-foreground text-xs">
                        <Trans>via WhatsApp · agora mesmo</Trans>
                      </div>
                    </div>
                    <CheckCircle2Icon className="h-5 w-5 text-emerald-500" />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3">
                  <span className="flex items-center gap-2 text-muted-foreground text-xs">
                    <ShieldCheckIcon className="h-4 w-4 text-emerald-500" />
                    <Trans>Selado com validade jurídica</Trans>
                  </span>
                  <span className="font-medium text-emerald-600 text-xs dark:text-emerald-400">
                    <Trans>ICP-Brasil</Trans>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features carousel */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-medium text-emerald-700 text-xs uppercase tracking-wide dark:text-emerald-300">
              <SparklesIcon className="h-3.5 w-3.5" />
              <Trans>Recursos</Trans>
            </span>
            <h2 className="mt-4 text-balance font-bold text-3xl tracking-tight sm:text-4xl">
              <Trans>Tudo que você precisa para assinar com confiança</Trans>
            </h2>
            <p className="mt-3 text-muted-foreground">
              <Trans>Arraste para explorar os recursos que tornam a CapivaSign pronta para o seu negócio.</Trans>
            </p>
          </div>
        </div>

        <div className="mt-10">
          <FeatureCarousel />
        </div>
      </section>

      {/* How it works */}
      <section className="border-border/60 border-y bg-muted/30">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="text-center font-bold text-3xl tracking-tight">
            <Trans>Como funciona</Trans>
          </h2>
          <div className="relative mt-14 grid gap-10 sm:grid-cols-3">
            <div
              aria-hidden
              className="absolute top-6 right-[16%] left-[16%] hidden border-emerald-500/20 border-t-2 border-dashed sm:block"
            />
            {STEPS.map((step) => (
              <div key={step.n} className="relative text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 font-bold text-lg text-white shadow-emerald-500/30 shadow-lg ring-4 ring-background">
                  {step.n}
                </div>
                <h3 className="mt-5 font-semibold text-lg">{step.title}</h3>
                <p className="mt-2 text-muted-foreground text-sm">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      {curatedPlans.length > 0 && (
        <section id="precos" className="relative overflow-hidden border-border/60 border-b">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-32 -z-10 mx-auto h-72 w-[42rem] rounded-full bg-emerald-400/10 blur-3xl"
          />

          <div className="mx-auto max-w-6xl px-6 py-24">
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

            <div
              className={`mt-14 grid items-stretch gap-6 sm:grid-cols-2 ${
                curatedPlans.length >= 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'
              }`}
            >
              {curatedPlans.map(({ claim, meta }) => {
                const items = PRICING_ITEMS.filter((item) => typeof claim.pricing[item.key] === 'number');
                // Capabilities (non-metered flags) this plan unlocks, e.g.
                // white-label. Sourced from the real DB flags.
                const planFlags = FLAG_COMPARISON_ROWS.filter((row) => claim.flags[row.key] === true);
                const Icon = meta.icon;
                const isPopular = meta.popular ?? false;

                return (
                  <div
                    key={claim.id}
                    className={`relative flex flex-col rounded-3xl p-6 transition-all ${
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

                    {planFlags.length > 0 && (
                      <>
                        <p className="mt-6 font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
                          <Trans>Recursos inclusos</Trans>
                        </p>
                        <ul className="mt-2 space-y-2">
                          {planFlags.map((flag) => (
                            <li key={flag.key} className="flex items-center gap-2 text-[13px]">
                              <CheckIcon className="h-4 w-4 shrink-0 text-emerald-500" />
                              <span>{flag.label}</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}

                    {items.length > 0 && (
                      <p className="mt-6 font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
                        <Trans>Consumo por ação</Trans>
                      </p>
                    )}

                    <ul className="mt-2 divide-y divide-border/60">
                      {items.map((item) => {
                        const quota = claim.pricing[item.quotaKey];
                        const freeQuota = typeof quota === 'number' && quota > 0 ? quota : null;

                        return (
                          <li key={item.key} className="flex items-start justify-between gap-3 py-2.5">
                            <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
                              <item.icon className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                              {item.label}
                            </span>
                            <span className="flex flex-col items-end">
                              <span className="font-semibold text-[13px] tabular-nums">
                                {formatBrl(claim.pricing[item.key] as number)}
                              </span>
                              {freeQuota !== null && (
                                <span className="font-medium text-[11px] text-emerald-600 tabular-nums dark:text-emerald-400">
                                  <Trans>{freeQuota} grátis/mês</Trans>
                                </span>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>

            {/* Feature comparison */}
            <div className="mt-24 text-center">
              <h3 className="font-bold text-2xl tracking-tight sm:text-3xl">
                <Trans>Recursos incluídos em cada plano</Trans>
              </h3>
              <p className="mt-3 text-muted-foreground">
                <Trans>Compare os principais recursos disponíveis em cada plano.</Trans>
              </p>
            </div>

            <div className="mt-10 overflow-x-auto rounded-3xl border border-border bg-card">
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
                    <tr key={row.key} className="border-border/50 border-b">
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

                  {activeFlagRows.map((row) => (
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
                          {renderFeatureValue(claim.flags[row.key] === true)}
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
            <div className="mt-20 grid gap-px overflow-hidden rounded-3xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
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
      <section className="mx-auto max-w-5xl px-6 py-24">
        <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-card to-card p-10 text-center sm:p-16">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 left-1/2 h-56 w-[36rem] -translate-x-1/2 rounded-full bg-emerald-400/20 blur-3xl"
          />
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
