import LogoIcon from '@documenso/assets/logo-icon-small.png';
import { SUPPORT_EMAIL } from '@documenso/lib/constants/app';
import type { TClaimFlags, TClaimPricing } from '@documenso/lib/types/subscription';
import { Button } from '@documenso/ui/primitives/button';
import { Trans } from '@lingui/react/macro';
import {
  ArrowRightIcon,
  BadgeCheckIcon,
  Building2Icon,
  CheckCircle2Icon,
  CheckIcon,
  ChevronDownIcon,
  DownloadIcon,
  FileSignatureIcon,
  FingerprintIcon,
  LayersIcon,
  LeafIcon,
  MailIcon,
  MessageCircleIcon,
  MinusIcon,
  PaletteIcon,
  PlugIcon,
  QrCodeIcon,
  ReceiptTextIcon,
  RefreshCwIcon,
  RocketIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserIcon,
  WalletIcon,
  WebhookIcon,
} from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
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

type IconComponent = ComponentType<{ className?: string }>;

// Shared brand accents: indigo (primary) fading into the pink of the logo.
const BRAND_GRADIENT_TEXT = 'bg-gradient-to-r from-brand-400 to-pink-400 bg-clip-text text-transparent';
const ICON_TILE = 'flex items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-300';

const formatBrl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Metered actions, keyed like `TClaimPricing` so prices come straight from the
// plan catalogue in the database.
const PRICING_ITEMS: {
  key: keyof TClaimPricing;
  quotaKey: keyof TClaimPricing;
  label: ReactNode;
  icon: IconComponent;
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
    label: <Trans>Download de arquivo pela API</Trans>,
    icon: DownloadIcon,
  },
  {
    key: 'embedSessionCents',
    quotaKey: 'embedSessionFreeQuota',
    label: <Trans>Sessão de assinatura incorporada</Trans>,
    icon: PlugIcon,
  },
];

// Capabilities each plan really has, read from the plan flags in the database.
const FLAG_ROWS: { key: keyof TClaimFlags; icon: IconComponent; label: ReactNode }[] = [
  { key: 'unlimitedDocuments', icon: FileSignatureIcon, label: <Trans>Documentos ilimitados</Trans> },
  { key: 'allowCustomBranding', icon: SparklesIcon, label: <Trans>Marca personalizada</Trans> },
  { key: 'whiteLabelBranding', icon: PaletteIcon, label: <Trans>White label (sua marca)</Trans> },
  { key: 'embedSigning', icon: PlugIcon, label: <Trans>Assinatura incorporada (embed)</Trans> },
  { key: 'signingReminders', icon: MailIcon, label: <Trans>Lembretes de assinatura</Trans> },
  { key: 'cscQesSigning', icon: FingerprintIcon, label: <Trans>Assinatura qualificada em nuvem</Trans> },
  { key: 'cfr21', icon: BadgeCheckIcon, label: <Trans>Conformidade 21 CFR Part 11</Trans> },
  { key: 'hipaa', icon: ShieldCheckIcon, label: <Trans>Conformidade HIPAA</Trans> },
];

// Copy and icon per plan, keyed by the lowercased plan name. Prices and
// capabilities always come from the database; a plan priced in admin without an
// entry here still shows up with the fallback.
type PlanMeta = {
  icon: IconComponent;
  tagline: ReactNode;
  highlight?: boolean;
  cta: { label: ReactNode; to?: string; href?: string };
};

const PLAN_ORDER = ['free', 'individual', 'early adopter', 'plataforma', 'enterprise'];

const PLAN_META: Record<string, PlanMeta> = {
  free: {
    icon: LeafIcon,
    tagline: <Trans>Para conhecer e para projetos pessoais.</Trans>,
    cta: { label: <Trans>Começar grátis</Trans>, to: '/signup' },
  },
  individual: {
    icon: UserIcon,
    tagline: <Trans>Para profissionais que assinam todo dia.</Trans>,
    highlight: true,
    cta: { label: <Trans>Assinar plano</Trans>, to: '/signup' },
  },
  'early adopter': {
    icon: RocketIcon,
    tagline: <Trans>Para startups e produtos em crescimento.</Trans>,
    cta: { label: <Trans>Assinar plano</Trans>, to: '/signup' },
  },
  plataforma: {
    icon: LayersIcon,
    tagline: <Trans>Para plataformas que assinam em escala.</Trans>,
    cta: { label: <Trans>Assinar plano</Trans>, to: '/signup' },
  },
  enterprise: {
    icon: Building2Icon,
    tagline: <Trans>Para alto volume e conformidade.</Trans>,
    cta: { label: <Trans>Falar com vendas</Trans>, href: `mailto:${SUPPORT_EMAIL}` },
  },
};

const FALLBACK_PLAN_META: PlanMeta = {
  icon: LayersIcon,
  tagline: null,
  cta: { label: <Trans>Assinar plano</Trans>, to: '/signup' },
};

const NAV_LINKS = [
  { href: '#recursos', label: <Trans>Recursos</Trans> },
  { href: '#como-funciona', label: <Trans>Como funciona</Trans> },
  { href: '#precos', label: <Trans>Preços</Trans> },
  { href: '#duvidas', label: <Trans>Dúvidas</Trans> },
];

const HERO_BADGES = [
  { icon: ShieldCheckIcon, label: <Trans>ICP-Brasil A1 e A3</Trans> },
  { icon: ScrollTextIcon, label: <Trans>Lei nº 14.063/2020</Trans> },
  { icon: MessageCircleIcon, label: <Trans>Assinatura por WhatsApp</Trans> },
  { icon: PlugIcon, label: <Trans>API e webhooks</Trans> },
];

const FEATURES: { icon: IconComponent; title: ReactNode; description: ReactNode }[] = [
  {
    icon: ShieldCheckIcon,
    title: <Trans>Validade jurídica ICP-Brasil</Trans>,
    description: (
      <Trans>
        Assinatura eletrônica avançada e qualificada com certificado A1 ou A3, conforme a Lei nº 14.063/2020.
      </Trans>
    ),
  },
  {
    icon: MessageCircleIcon,
    title: <Trans>Assinatura pelo WhatsApp</Trans>,
    description: <Trans>O pedido chega no WhatsApp do signatário, que assina pelo celular em poucos toques.</Trans>,
  },
  {
    icon: PaletteIcon,
    title: <Trans>A sua marca em tudo</Trans>,
    description: <Trans>Páginas de assinatura, e-mails e certificados com o seu logotipo e as suas cores.</Trans>,
  },
  {
    icon: PlugIcon,
    title: <Trans>API, webhooks e embed</Trans>,
    description: <Trans>Integre a assinatura ao seu sistema e receba cada evento em tempo real.</Trans>,
  },
  {
    icon: QrCodeIcon,
    title: <Trans>Verificação pública</Trans>,
    description: (
      <Trans>Cada documento traz QR Code e hash SHA-256 para qualquer pessoa conferir a autenticidade.</Trans>
    ),
  },
  {
    icon: ScrollTextIcon,
    title: <Trans>Trilha de auditoria</Trans>,
    description: (
      <Trans>Relatório com IP, dispositivo, data e hora de cada etapa, anexado ao documento assinado.</Trans>
    ),
  },
];

const STEPS = [
  {
    title: <Trans>Envie o documento</Trans>,
    text: <Trans>Suba o PDF, posicione os campos e escolha quem assina.</Trans>,
  },
  {
    title: <Trans>Colete as assinaturas</Trans>,
    text: <Trans>Por link, e-mail ou WhatsApp, com ou sem certificado ICP-Brasil.</Trans>,
  },
  {
    title: <Trans>Receba o documento selado</Trans>,
    text: <Trans>Todos recebem o PDF assinado, com relatório de auditoria e verificação pública.</Trans>,
  },
];

const BILLING_HIGHLIGHTS = [
  {
    icon: ReceiptTextIcon,
    title: <Trans>Uma fatura por mês</Trans>,
    text: <Trans>Mensalidade e uso do mês juntos, detalhados item a item.</Trans>,
  },
  {
    icon: WalletIcon,
    title: <Trans>Pix, boleto ou cartão</Trans>,
    text: <Trans>Você escolhe como pagar em cada fatura.</Trans>,
  },
  {
    icon: RefreshCwIcon,
    title: <Trans>Troque de plano quando quiser</Trans>,
    text: <Trans>Direto pela página de cobrança, sem falar com ninguém.</Trans>,
  },
  {
    icon: SparklesIcon,
    title: <Trans>Franquia grátis todo mês</Trans>,
    text: <Trans>Cada plano inclui uma quantidade de ações sem custo.</Trans>,
  },
];

const FAQ: { question: ReactNode; answer: ReactNode }[] = [
  {
    question: <Trans>A assinatura tem validade jurídica?</Trans>,
    answer: (
      <Trans>
        Sim. As assinaturas seguem a Lei nº 14.063/2020. Com certificado ICP-Brasil, a assinatura é qualificada e tem a
        mesma validade de uma assinatura de próprio punho.
      </Trans>
    ),
  },
  {
    question: <Trans>Quem vai assinar precisa criar conta?</Trans>,
    answer: <Trans>Não. O signatário assina pelo link que recebe por e-mail ou WhatsApp.</Trans>,
  },
  {
    question: <Trans>Preciso de certificado digital?</Trans>,
    answer: (
      <Trans>
        Não para a assinatura eletrônica. Para assinar com ICP-Brasil, use um certificado A1 (arquivo) ou A3 (token ou
        cartão) com o assinador CapivaSign.
      </Trans>
    ),
  },
  {
    question: <Trans>Como funciona a cobrança?</Trans>,
    answer: (
      <Trans>
        Todo dia 1º sai uma fatura com a mensalidade do plano e o uso do mês anterior. Você paga por Pix, boleto ou
        cartão.
      </Trans>
    ),
  },
  {
    question: <Trans>Posso trocar ou cancelar o plano?</Trans>,
    answer: (
      <Trans>
        Sim, na página de cobrança. Um plano maior vale na hora. Um plano menor, ou voltar ao gratuito, vale a partir do
        mês seguinte.
      </Trans>
    ),
  },
  {
    question: <Trans>Consigo integrar com o meu sistema?</Trans>,
    answer: (
      <Trans>
        Sim. Há API completa e webhooks em todos os planos, e assinatura incorporada nos planos que incluem o recurso.
      </Trans>
    ),
  },
];

const getPlanKey = (claim: PublicPricingClaim) => claim.name.trim().toLowerCase();

const getPlanOrder = (key: string) => {
  const index = PLAN_ORDER.indexOf(key);

  return index === -1 ? PLAN_ORDER.length : index;
};

const SectionHeading = ({
  eyebrow,
  title,
  description,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  description?: ReactNode;
}) => (
  <div className="mx-auto max-w-2xl text-center">
    <span className="font-semibold text-brand-600 text-sm uppercase tracking-wider dark:text-brand-300">{eyebrow}</span>
    <h2 className="mt-3 text-balance font-bold text-3xl tracking-tight sm:text-4xl">{title}</h2>
    {description && <p className="mt-4 text-balance text-lg text-muted-foreground">{description}</p>}
  </div>
);

const FeatureValue = ({ isEnabled }: { isEnabled: boolean }) =>
  isEnabled ? (
    <CheckIcon className="mx-auto h-4 w-4 text-brand-500" />
  ) : (
    <MinusIcon className="mx-auto h-4 w-4 text-muted-foreground/40" />
  );

const UsagePrice = ({ pricing, item }: { pricing: TClaimPricing; item: (typeof PRICING_ITEMS)[number] }) => {
  const price = pricing[item.key];
  const quota = pricing[item.quotaKey];

  if (typeof price !== 'number') {
    return <MinusIcon className="mx-auto h-4 w-4 text-muted-foreground/40" />;
  }

  return (
    <div className="flex flex-col items-center leading-tight">
      <span className="font-semibold text-sm tabular-nums">{formatBrl(price)}</span>
      {typeof quota === 'number' && quota > 0 && (
        <span className="mt-0.5 whitespace-nowrap text-muted-foreground text-xs tabular-nums">
          <Trans>{quota} grátis/mês</Trans>
        </span>
      )}
    </div>
  );
};

const HeroMockup = () => (
  <div className="relative mx-auto w-full max-w-md lg:max-w-none">
    <div
      aria-hidden
      className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-tr from-brand-500/20 to-pink-500/20 blur-3xl"
    />

    <img src={LogoIcon} alt="" className="absolute -top-14 -right-4 z-10 h-28 w-28 drop-shadow-2xl" />

    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
      <div className="flex items-center gap-1.5 border-border/60 border-b bg-muted/40 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
        <span className="ml-3 truncate text-muted-foreground text-xs">contrato-prestacao-de-servicos.pdf</span>
      </div>

      <div className="space-y-3 p-6">
        <div className="h-2.5 w-2/3 rounded-full bg-muted" />
        <div className="h-2 w-full rounded-full bg-muted/70" />
        <div className="h-2 w-11/12 rounded-full bg-muted/70" />
        <div className="h-2 w-4/5 rounded-full bg-muted/70" />

        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-border bg-background/60 p-4">
          <img src={LogoIcon} alt="" className="h-11 w-11 object-contain" />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] text-muted-foreground">
              <Trans>Assinado eletronicamente por</Trans>
            </div>
            <div className="truncate font-semibold text-sm">Maria Oliveira</div>
            <div className="text-[11px] text-brand-600 dark:text-brand-300">
              <Trans>ICP-Brasil · certificado A3</Trans>
            </div>
          </div>
          <CheckCircle2Icon className="h-5 w-5 shrink-0 text-green-500" />
        </div>

        <ol className="space-y-2 pt-2 text-xs">
          <li className="flex items-center gap-2 text-muted-foreground">
            <MessageCircleIcon className="h-3.5 w-3.5 text-brand-500" />
            <Trans>Pedido enviado por WhatsApp</Trans>
          </li>
          <li className="flex items-center gap-2 text-muted-foreground">
            <FingerprintIcon className="h-3.5 w-3.5 text-brand-500" />
            <Trans>Assinado com certificado digital</Trans>
          </li>
          <li className="flex items-center gap-2 font-medium text-foreground">
            <QrCodeIcon className="h-3.5 w-3.5 text-brand-500" />
            <Trans>Documento selado e verificável</Trans>
          </li>
        </ol>
      </div>
    </div>
  </div>
);

type CuratedPlan = { claim: PublicPricingClaim; meta: PlanMeta };

const PlanCard = ({ claim, meta }: CuratedPlan) => {
  const Icon = meta.icon;
  const planFlags = FLAG_ROWS.filter((row) => claim.flags[row.key] === true);
  const isHighlighted = meta.highlight ?? false;

  return (
    <div
      className={`relative flex h-full flex-col rounded-3xl p-6 ${
        isHighlighted
          ? 'border-2 border-brand-500 bg-gradient-to-b from-brand-500/10 to-card shadow-brand-500/10 shadow-xl'
          : 'border border-border bg-card'
      }`}
    >
      {isHighlighted && (
        <span className="absolute -top-3 left-6 rounded-full bg-brand-600 px-3 py-1 font-semibold text-[11px] text-white uppercase tracking-wide">
          <Trans>Recomendado</Trans>
        </span>
      )}

      <div className={`${ICON_TILE} h-11 w-11`}>
        <Icon className="h-5 w-5" />
      </div>

      <h3 className="mt-4 font-semibold text-xl">{claim.name}</h3>
      <p className="mt-1 min-h-[2.5rem] text-muted-foreground text-sm leading-snug">{meta.tagline}</p>

      <div className="mt-6 whitespace-nowrap font-bold text-3xl tracking-tight xl:text-4xl">
        {formatBrl(claim.pricing.monthlyPriceCents ?? 0)}
      </div>
      <p className="mt-1 text-muted-foreground text-xs">
        <Trans>por mês, mais o uso com franquia grátis</Trans>
      </p>

      <Button variant={isHighlighted ? 'default' : 'outline'} className="mt-6 w-full" asChild>
        {meta.cta.href ? (
          <a href={meta.cta.href}>{meta.cta.label}</a>
        ) : (
          <Link to={meta.cta.to ?? '/signup'}>{meta.cta.label}</Link>
        )}
      </Button>

      <ul className="mt-6 space-y-2.5 border-border/60 border-t pt-6 text-sm">
        <li className="flex items-start gap-2">
          <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
          <Trans>Assinatura eletrônica e ICP-Brasil</Trans>
        </li>
        <li className="flex items-start gap-2">
          <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
          <Trans>API, webhooks e WhatsApp</Trans>
        </li>
        {planFlags.map((flag) => (
          <li key={flag.key} className="flex items-start gap-2">
            <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
            {flag.label}
          </li>
        ))}
      </ul>
    </div>
  );
};

const PlanComparison = ({ plans }: { plans: CuratedPlan[] }) => {
  // Only rows at least one plan offers, so nothing is listed that nobody sells.
  const flagRows = FLAG_ROWS.filter((row) => plans.some(({ claim }) => claim.flags[row.key] === true));
  const usageRows = PRICING_ITEMS.filter((item) =>
    plans.some(({ claim }) => typeof claim.pricing[item.key] === 'number'),
  );

  const groupRow = (label: ReactNode) => (
    <tr className="bg-muted/40">
      <th
        colSpan={plans.length + 1}
        className="px-5 py-2.5 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide"
      >
        {label}
      </th>
    </tr>
  );

  const labelCell = (Icon: IconComponent, label: ReactNode) => (
    <td className="px-5 py-3">
      <span className="flex items-center gap-2.5 text-sm">
        <Icon className="h-4 w-4 shrink-0 text-brand-500" />
        {label}
      </span>
    </td>
  );

  return (
    <div className="mt-16 overflow-x-auto rounded-3xl border border-border bg-card">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr className="border-border border-b">
            <th className="w-1/3 px-5 py-4 text-left font-semibold text-sm">
              <Trans>Compare os planos</Trans>
            </th>
            {plans.map(({ claim }) => (
              <th key={claim.id} className="px-4 py-4 text-center font-semibold text-sm">
                {claim.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {flagRows.length > 0 && groupRow(<Trans>Recursos</Trans>)}
          {flagRows.map((row) => (
            <tr key={row.key}>
              {labelCell(row.icon, row.label)}
              {plans.map(({ claim }) => (
                <td key={claim.id} className="px-4 py-3 text-center">
                  <FeatureValue isEnabled={claim.flags[row.key] === true} />
                </td>
              ))}
            </tr>
          ))}

          {usageRows.length > 0 && groupRow(<Trans>Preço por uso</Trans>)}
          {usageRows.map((item) => (
            <tr key={item.key}>
              {labelCell(item.icon, item.label)}
              {plans.map(({ claim }) => (
                <td key={claim.id} className="px-4 py-3 text-center">
                  <UsagePrice pricing={claim.pricing} item={item} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const LandingHeader = () => (
  <header className="sticky top-0 z-40 border-border/60 border-b bg-background/80 backdrop-blur">
    <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-3">
      <Link to="/" aria-label="CapivaSign">
        <BrandingLogo className="h-9 w-auto" />
      </Link>

      <nav className="hidden items-center gap-1 md:flex">
        {NAV_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="rounded-lg px-3 py-2 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
          >
            {link.label}
          </a>
        ))}
      </nav>

      <div className="flex items-center gap-2">
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
      </div>
    </div>
  </header>
);

const LandingFooter = () => {
  const year = new Date().getFullYear();

  const linkClass = 'text-muted-foreground text-sm transition-colors hover:text-foreground';

  return (
    <footer className="border-border/60 border-t">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <BrandingLogo className="h-9 w-auto" />
          <p className="mt-4 max-w-xs text-muted-foreground text-sm">
            <Trans>Assinatura eletrônica e digital ICP-Brasil, por link, e-mail ou WhatsApp.</Trans>
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-sm">
            <Trans>Produto</Trans>
          </h3>
          <ul className="mt-4 space-y-3">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} className={linkClass}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-sm">
            <Trans>Conta</Trans>
          </h3>
          <ul className="mt-4 space-y-3">
            <li>
              <Link to="/signin" className={linkClass}>
                <Trans>Entrar</Trans>
              </Link>
            </li>
            <li>
              <Link to="/signup" className={linkClass}>
                <Trans>Criar conta</Trans>
              </Link>
            </li>
            <li>
              <Link to="/signer" className={linkClass}>
                <Trans>Baixar assinador</Trans>
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-sm">
            <Trans>Contato</Trans>
          </h3>
          <ul className="mt-4 space-y-3">
            <li>
              <a href={`mailto:${SUPPORT_EMAIL}`} className={linkClass}>
                {SUPPORT_EMAIL}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-border/60 border-t">
        <p className="mx-auto max-w-6xl px-6 py-6 text-muted-foreground text-xs">
          <Trans>© {year} CapivaSign. Todos os direitos reservados.</Trans>
        </p>
      </div>
    </footer>
  );
};

export const LandingPage = ({ pricingClaims }: LandingPageProps) => {
  const plans: CuratedPlan[] = [...pricingClaims]
    .sort((a, b) => getPlanOrder(getPlanKey(a)) - getPlanOrder(getPlanKey(b)))
    .map((claim) => ({ claim, meta: PLAN_META[getPlanKey(claim)] ?? FALLBACK_PLAN_META }));

  return (
    <div className="min-h-screen scroll-smooth bg-background text-foreground">
      <LandingHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[28rem] w-[56rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-brand-500/25 to-pink-500/20 blur-3xl"
        />

        <div className="mx-auto grid max-w-6xl items-center gap-16 px-6 pt-16 pb-24 sm:pt-24 lg:grid-cols-[1.1fr_1fr]">
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 font-medium text-brand-700 text-xs dark:text-brand-200">
              <ShieldCheckIcon className="h-3.5 w-3.5" />
              <Trans>Assinatura digital com validade jurídica</Trans>
            </span>

            <h1 className="mt-6 text-balance font-bold text-4xl tracking-tight sm:text-6xl">
              <Trans>
                Seus documentos assinados <span className={BRAND_GRADIENT_TEXT}>em minutos</span>, de qualquer lugar
              </Trans>
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-balance text-lg text-muted-foreground lg:mx-0">
              <Trans>
                Envie por link, e-mail ou WhatsApp. Quem assina não precisa de conta, e você recebe o documento selado,
                com trilha de auditoria e verificação pública.
              </Trans>
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
              <Button size="lg" asChild>
                <Link to="/signup">
                  <Trans>Criar conta grátis</Trans>
                  <ArrowRightIcon className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#precos">
                  <Trans>Ver preços</Trans>
                </a>
              </Button>
            </div>

            <ul className="mt-10 flex flex-wrap justify-center gap-2 lg:justify-start">
              {HERO_BADGES.map((badge, index) => (
                <li
                  key={index}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-muted-foreground text-xs"
                >
                  <badge.icon className="h-3.5 w-3.5 text-brand-500" />
                  {badge.label}
                </li>
              ))}
            </ul>
          </div>

          <HeroMockup />
        </div>
      </section>

      {/* Features */}
      <section id="recursos" className="scroll-mt-20 border-border/60 border-t bg-muted/20">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <SectionHeading
            eyebrow={<Trans>Recursos</Trans>}
            title={<Trans>Tudo o que você precisa para assinar com segurança</Trans>}
          />

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, index) => (
              <article
                key={index}
                className="rounded-3xl border border-border bg-card p-7 transition-colors hover:border-brand-500/50"
              >
                <div className={`${ICON_TILE} h-12 w-12`}>
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 font-semibold text-lg">{feature.title}</h3>
                <p className="mt-2 text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="como-funciona" className="scroll-mt-20 border-border/60 border-t">
        <div className="mx-auto max-w-5xl px-6 py-24">
          <SectionHeading eyebrow={<Trans>Como funciona</Trans>} title={<Trans>Do PDF ao documento selado</Trans>} />

          <div className="relative mt-14">
            <div
              aria-hidden
              className="absolute top-6 right-[16%] left-[16%] hidden border-brand-500/30 border-t-2 border-dashed sm:block"
            />
            <ol className="relative grid gap-10 sm:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={index} className="relative text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 font-bold text-lg text-white shadow-brand-500/30 shadow-lg ring-4 ring-background">
                    {index + 1}
                  </div>
                  <h3 className="mt-5 font-semibold text-lg">{step.title}</h3>
                  <p className="mt-2 text-muted-foreground text-sm">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Pricing */}
      {plans.length > 0 && (
        <section id="precos" className="scroll-mt-20 border-border/60 border-t bg-muted/20">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <SectionHeading
              eyebrow={<Trans>Preços</Trans>}
              title={
                <Trans>
                  Pague a mensalidade do plano e <span className={BRAND_GRADIENT_TEXT}>só o que usar</span>
                </Trans>
              }
              description={<Trans>Todos os planos incluem uma franquia grátis de uso por mês.</Trans>}
            />

            <div
              className={`mt-16 grid items-stretch gap-6 sm:grid-cols-2 ${
                plans.length >= 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'
              }`}
            >
              {plans.map((plan) => (
                <PlanCard key={plan.claim.id} {...plan} />
              ))}
            </div>

            <PlanComparison plans={plans} />

            <p className="mt-4 text-center text-muted-foreground text-xs">
              <Trans>Valores por ação, em reais. Ações não listadas não são cobradas.</Trans>
            </p>

            <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {BILLING_HIGHLIGHTS.map((highlight, index) => (
                <div key={index} className="flex gap-4">
                  <div className={`${ICON_TILE} h-10 w-10 shrink-0`}>
                    <highlight.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{highlight.title}</h3>
                    <p className="mt-1 text-muted-foreground text-sm leading-relaxed">{highlight.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section id="duvidas" className="scroll-mt-20 border-border/60 border-t">
        <div className="mx-auto max-w-3xl px-6 py-24">
          <SectionHeading eyebrow={<Trans>Dúvidas</Trans>} title={<Trans>Perguntas frequentes</Trans>} />

          <div className="mt-12 divide-y divide-border rounded-3xl border border-border bg-card">
            {FAQ.map((item, index) => (
              <details key={index} className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {item.question}
                  <ChevronDownIcon className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-muted-foreground text-sm leading-relaxed">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-pink-600 p-10 text-center text-white sm:p-16">
          <img
            src={LogoIcon}
            alt=""
            aria-hidden
            className="pointer-events-none absolute -right-6 -bottom-8 h-40 w-40 opacity-20 sm:h-56 sm:w-56"
          />
          <h2 className="font-bold text-3xl tracking-tight sm:text-4xl">
            <Trans>Envie o seu primeiro documento hoje</Trans>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/80">
            <Trans>Crie a conta grátis em menos de um minuto. Sem cartão de crédito.</Trans>
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" variant="secondary" asChild>
              <Link to="/signup">
                <Trans>Criar conta grátis</Trans>
                <ArrowRightIcon className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="ghost" className="text-white hover:bg-white/10 hover:text-white" asChild>
              <a href={`mailto:${SUPPORT_EMAIL}`}>
                <Trans>Falar com vendas</Trans>
              </a>
            </Button>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
};
