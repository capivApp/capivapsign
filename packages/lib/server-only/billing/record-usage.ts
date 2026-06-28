import { BillableEventType } from '@prisma/client';
import type { Prisma } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import type { TClaimPricing } from '../../types/subscription';
import type { ApiRequestMetadata } from '../../universal/extract-request-metadata';
import { generateDatabaseId } from '../../universal/id';
import { logger } from '../../utils/logger';

/** Maps a billable event to its price + free-quota fields on the claim `pricing`. */
const PRICING_KEY: Record<BillableEventType, keyof TClaimPricing> = {
  [BillableEventType.CREATE_DOCUMENT]: 'createDocumentCents',
  [BillableEventType.RECOVER_FILE]: 'recoverFileCents',
  [BillableEventType.WHATSAPP_MESSAGE]: 'whatsappMessageCents',
  [BillableEventType.WEBHOOK_DELIVERY]: 'webhookDeliveryCents',
  [BillableEventType.EMAIL_MESSAGE]: 'emailMessageCents',
  [BillableEventType.EMBED_SESSION]: 'embedSessionCents',
};

const QUOTA_KEY: Record<BillableEventType, keyof TClaimPricing> = {
  [BillableEventType.CREATE_DOCUMENT]: 'createDocumentFreeQuota',
  [BillableEventType.RECOVER_FILE]: 'recoverFileFreeQuota',
  [BillableEventType.WHATSAPP_MESSAGE]: 'whatsappMessageFreeQuota',
  [BillableEventType.WEBHOOK_DELIVERY]: 'webhookDeliveryFreeQuota',
  [BillableEventType.EMAIL_MESSAGE]: 'emailMessageFreeQuota',
  [BillableEventType.EMBED_SESSION]: 'embedSessionFreeQuota',
};

export type RecordUsageOptions = {
  type: BillableEventType;
  /** Request source. Panel (`app`) usage is free unless `alwaysBill` is set. */
  source: ApiRequestMetadata['source'];
  /** Provide either the organisation directly or a team to resolve it from. */
  organisationId?: string;
  teamId?: number;
  userId?: number | null;
  apiTokenId?: number | null;
  quantity?: number;
  metadata?: Prisma.InputJsonValue;
  /**
   * Which WhatsApp transport sent the message — selects the conditional price
   * (`own` = the org's own transport, otherwise CapivaSign's default sender).
   * Only relevant for WHATSAPP_MESSAGE.
   */
  whatsappTransport?: 'capiva' | 'own';
  /**
   * Bill even for panel (`app`) source. Used by system-driven integration
   * actions that aren't a user panel action (e.g. webhook deliveries).
   */
  alwaysBill?: boolean;
};

/** Resolves the per-unit price, honouring the WhatsApp transport split. */
const resolveUnitPrice = (
  pricing: TClaimPricing,
  options: RecordUsageOptions,
): number => {
  if (options.type === BillableEventType.WHATSAPP_MESSAGE && options.whatsappTransport === 'own') {
    return pricing.whatsappOwnMessageCents ?? pricing.whatsappMessageCents ?? 0;
  }

  return pricing[PRICING_KEY[options.type]] ?? 0;
};

const startOfMonthUtc = (): Date => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
};

/**
 * Records one billable usage event, priced off the organisation claim's
 * `pricing`. Best-effort: never throws — metering must not break the action it
 * measures. No-ops for panel usage (only API usage is billed) unless
 * `alwaysBill` is set.
 */
export const recordUsage = async (options: RecordUsageOptions): Promise<void> => {
  try {
    if (!options.alwaysBill && options.source === 'app') {
      return;
    }

    const organisation = await resolveOrganisation(options);

    if (!organisation) {
      logger.warn({ msg: 'recordUsage: could not resolve organisation', type: options.type });
      return;
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const pricing = (organisation.organisationClaim.pricing ?? {}) as TClaimPricing;
    const unitPriceCents = resolveUnitPrice(pricing, options);
    const quantity = options.quantity ?? 1;

    // Free monthly allowance: the first `quota` events of this type each calendar
    // month are not charged; only the units beyond the quota are billed.
    const quota = pricing[QUOTA_KEY[options.type]] ?? 0;

    let chargeableQuantity = quantity;

    if (quota > 0) {
      const priorThisMonth = await prisma.usageEvent.count({
        where: {
          organisationId: organisation.id,
          type: options.type,
          createdAt: { gte: startOfMonthUtc() },
        },
      });

      const remainingFree = Math.max(0, quota - priorThisMonth);
      chargeableQuantity = Math.max(0, quantity - remainingFree);
    }

    await prisma.usageEvent.create({
      data: {
        id: generateDatabaseId('usage_event'),
        organisationId: organisation.id,
        teamId: options.teamId ?? null,
        userId: options.userId ?? null,
        apiTokenId: options.apiTokenId ?? null,
        type: options.type,
        quantity,
        // unitPriceCents stays as the catalogue rate; amount reflects the quota.
        unitPriceCents,
        amountCents: unitPriceCents * chargeableQuantity,
        source: options.source,
        metadata: options.metadata,
      },
    });
  } catch (err) {
    logger.error({ msg: 'recordUsage failed', err, type: options.type });
  }
};

const resolveOrganisation = async (options: RecordUsageOptions) => {
  if (options.organisationId) {
    return prisma.organisation.findUnique({
      where: { id: options.organisationId },
      include: { organisationClaim: true },
    });
  }

  if (options.teamId !== undefined) {
    const team = await prisma.team.findUnique({
      where: { id: options.teamId },
      select: { organisation: { include: { organisationClaim: true } } },
    });

    return team?.organisation ?? null;
  }

  return null;
};
