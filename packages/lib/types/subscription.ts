import type { SubscriptionClaim } from '@prisma/client';
import { z } from 'zod';

/**
 * Rate limit window schema.
 *
 * Example: "5m", "1h", "1d"
 */
export const ZRateLimitWindowSchema = z.string().regex(/^\d+[smhd]$/);

export const ZRateLimitArraySchema = z.array(
  z.object({
    window: ZRateLimitWindowSchema,
    max: z.number().int().positive(),
  }),
);

export type TRateLimitArray = z.infer<typeof ZRateLimitArraySchema>;

/**
 * README:
 * - If you update this you MUST update the `backport-subscription-claims` schema as well.
 */
export const ZClaimFlagsSchema = z.object({
  /**
   * Allows disabling of Documenso branding for:
   * - Certificates
   * - Emails
   * - Other?
   */
  allowCustomBranding: z.boolean().optional(),
  hidePoweredBy: z.boolean().optional(),

  unlimitedDocuments: z.boolean().optional(),

  emailDomains: z.boolean().optional(),

  embedAuthoring: z.boolean().optional(),
  embedAuthoringWhiteLabel: z.boolean().optional(),

  embedSigning: z.boolean().optional(),
  embedSigningWhiteLabel: z.boolean().optional(),

  cfr21: z.boolean().optional(),

  hipaa: z.boolean().optional(),

  authenticationPortal: z.boolean().optional(),

  allowLegacyEnvelopes: z.boolean().optional(),

  signingReminders: z.boolean().optional(),

  cscQesSigning: z.boolean().optional(),

  /**
   * White-label branding with the customer's own brand (logo/colours) across
   * signing pages, emails and certificates — gated to paid claims.
   */
  whiteLabelBranding: z.boolean().optional(),

  /**
   * Allows dragging to reposition the audit/verification mark on the document
   * pages (custom X/Y). When off, only the preset positions are available.
   */
  draggableVerificationMark: z.boolean().optional(),

  /**
   * Controls whether an organisation is prevented from sending emails.
   *
   * When this is enabled, ALL emails for the organisation are blocked.
   */
  disableEmails: z.boolean().optional(),
});

export type TClaimFlags = z.infer<typeof ZClaimFlagsSchema>;

/**
 * Per-item pricing for metered, API-only billable actions. Values are in cents
 * (BRL). Absent / null = not billed. Lives on the claim (Subscription +
 * Organisation), alongside `emailTransportId`/`whatsappTransportId`, so the
 * admin sets prices when creating a claim and they flow to each organisation.
 *
 * README: keep in sync with `BillableEventType` and the metering instrumentation.
 */
const ZCents = z.number().int().min(0).nullable().optional();
const ZQuota = z.number().int().min(0).nullable().optional();

export const ZClaimPricingSchema = z.object({
  /** Fixed plan price charged every month, on top of metered usage. */
  monthlyPriceCents: ZCents,

  // Per-action unit prices (cents). Absent / null = not billed.
  createDocumentCents: ZCents,
  recoverFileCents: ZCents,
  // WhatsApp is conditional on which transport sent the message:
  //  - whatsappMessageCents     → CapivaSign's default transport (typically pricier)
  //  - whatsappOwnMessageCents  → the organisation's own configured transport
  whatsappMessageCents: ZCents,
  whatsappOwnMessageCents: ZCents,
  webhookDeliveryCents: ZCents,
  emailMessageCents: ZCents,
  embedSessionCents: ZCents,

  // Free monthly allowance per action; usage up to the quota is not charged.
  createDocumentFreeQuota: ZQuota,
  recoverFileFreeQuota: ZQuota,
  whatsappMessageFreeQuota: ZQuota,
  webhookDeliveryFreeQuota: ZQuota,
  emailMessageFreeQuota: ZQuota,
  embedSessionFreeQuota: ZQuota,
});

export type TClaimPricing = z.infer<typeof ZClaimPricingSchema>;

/**
 * UI metadata for the per-item pricing fields, grouped for the admin claim form.
 * `unitKey` = price field, `quotaKey` = free-allowance field.
 */
export const SUBSCRIPTION_CLAIM_PRICING_ITEMS: {
  unitKey: keyof TClaimPricing;
  quotaKey: keyof TClaimPricing;
  label: string;
  /** Optional secondary price (WhatsApp via the org's own transport). */
  altUnitKey?: keyof TClaimPricing;
  altLabel?: string;
}[] = [
  { unitKey: 'createDocumentCents', quotaKey: 'createDocumentFreeQuota', label: 'Criar documento' },
  { unitKey: 'recoverFileCents', quotaKey: 'recoverFileFreeQuota', label: 'Recuperar arquivo (download)' },
  {
    unitKey: 'whatsappMessageCents',
    quotaKey: 'whatsappMessageFreeQuota',
    label: 'WhatsApp (remetente CapivaSign)',
    altUnitKey: 'whatsappOwnMessageCents',
    altLabel: 'WhatsApp (remetente próprio)',
  },
  { unitKey: 'webhookDeliveryCents', quotaKey: 'webhookDeliveryFreeQuota', label: 'Entrega de webhook' },
  { unitKey: 'emailMessageCents', quotaKey: 'emailMessageFreeQuota', label: 'Mensagem de e-mail' },
  { unitKey: 'embedSessionCents', quotaKey: 'embedSessionFreeQuota', label: 'Sessão de posicionador (embed)' },
];

// When adding keys, update internal documentation with this.
export const SUBSCRIPTION_CLAIM_FEATURE_FLAGS: Record<
  keyof TClaimFlags,
  {
    label: string;
    key: keyof TClaimFlags;
    isEnterprise?: boolean;
  }
> = {
  unlimitedDocuments: {
    key: 'unlimitedDocuments',
    label: 'Documentos ilimitados',
  },
  allowCustomBranding: {
    key: 'allowCustomBranding',
    label: 'Marca personalizada',
  },
  hidePoweredBy: {
    key: 'hidePoweredBy',
    label: 'Ocultar "Desenvolvido por"',
  },
  whiteLabelBranding: {
    key: 'whiteLabelBranding',
    label: 'White label (marca da empresa)',
  },
  draggableVerificationMark: {
    key: 'draggableVerificationMark',
    label: 'Marca de verificação arrastável (posição X/Y)',
  },
  emailDomains: {
    key: 'emailDomains',
    label: 'Domínios de e-mail',
    isEnterprise: true,
  },
  embedAuthoring: {
    key: 'embedAuthoring',
    label: 'Edição incorporada (embed)',
    isEnterprise: true,
  },
  embedSigning: {
    key: 'embedSigning',
    label: 'Assinatura incorporada (embed)',
  },
  embedAuthoringWhiteLabel: {
    key: 'embedAuthoringWhiteLabel',
    label: 'White label para edição incorporada',
    isEnterprise: true,
  },
  embedSigningWhiteLabel: {
    key: 'embedSigningWhiteLabel',
    label: 'White label para assinatura incorporada',
  },
  cfr21: {
    key: 'cfr21',
    label: '21 CFR',
    isEnterprise: true,
  },
  hipaa: {
    key: 'hipaa',
    label: 'HIPAA',
    isEnterprise: true,
  },
  authenticationPortal: {
    key: 'authenticationPortal',
    label: 'Portal de autenticação',
    isEnterprise: true,
  },
  allowLegacyEnvelopes: {
    key: 'allowLegacyEnvelopes',
    label: 'Permitir envelopes legados',
  },
  signingReminders: {
    key: 'signingReminders',
    label: 'Lembretes de assinatura',
  },
  cscQesSigning: {
    key: 'cscQesSigning',
    label: 'Assinatura QES',
    isEnterprise: true,
  },
  disableEmails: {
    key: 'disableEmails',
    label: 'Desativar e-mails',
  },
};

export enum INTERNAL_CLAIM_ID {
  FREE = 'free',
  INDIVIDUAL = 'individual',
  TEAM = 'team',
  EARLY_ADOPTER = 'earlyAdopter',
  PLATFORM = 'platform',
  ENTERPRISE = 'enterprise',
}

export type InternalClaim = Pick<SubscriptionClaim, 'id' | 'name'>;

export type InternalClaims = {
  [key in INTERNAL_CLAIM_ID]: InternalClaim;
};

export const internalClaims: InternalClaims = {
  /**
   * Free plan has no rates and quotas since this may break self-hosters.
   */
  [INTERNAL_CLAIM_ID.FREE]: {
    id: INTERNAL_CLAIM_ID.FREE,
    name: 'Free',
  },
  [INTERNAL_CLAIM_ID.INDIVIDUAL]: {
    id: INTERNAL_CLAIM_ID.INDIVIDUAL,
    name: 'Individual',
  },
  [INTERNAL_CLAIM_ID.TEAM]: {
    id: INTERNAL_CLAIM_ID.TEAM,
    name: 'Teams',
  },
  [INTERNAL_CLAIM_ID.PLATFORM]: {
    id: INTERNAL_CLAIM_ID.PLATFORM,
    name: 'Platform',
  },
  [INTERNAL_CLAIM_ID.ENTERPRISE]: {
    id: INTERNAL_CLAIM_ID.ENTERPRISE,
    name: 'Enterprise',
  },
  [INTERNAL_CLAIM_ID.EARLY_ADOPTER]: {
    id: INTERNAL_CLAIM_ID.EARLY_ADOPTER,
    name: 'Early Adopter',
  },
} as const;
