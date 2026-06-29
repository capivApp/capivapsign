import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { env } from '../../utils/env';
import { logger } from '../../utils/logger';
import type { WhatsappAdapter } from './adapters/whatsapp-adapter';
import { createZapiAdapter } from './adapters/zapi-adapter';
import { resolveDefaultWhatsappTransport, resolveWhatsappTransport } from './resolve-whatsapp-transport';

export type WhatsappContext = {
  organisationId: string;
  adapter: WhatsappAdapter;
  /** Sender display name surfaced to the message flow. */
  fromName: string;
  /**
   * Which transport is in use, for conditional billing:
   *  - `own`    → the organisation's own configured transport
   *  - `capiva` → CapivaSign's default (env) transport
   */
  kind: 'own' | 'capiva';
  /**
   * False when neither a per-plan transport nor the CapivaApp env default is
   * configured — the caller must skip sending instead of throwing.
   */
  enabled: boolean;
};

const DEFAULT_FROM_NAME = 'CapivaSign';

type GetWhatsappContextOptions =
  | { type: 'organisation'; organisationId: string }
  | { type: 'team'; teamId: number };

/**
 * Resolves the WhatsApp sending context for an organisation/team: the per-plan
 * transport configured on the org claim, falling back to the CapivaApp default
 * transport from env. Mirrors the email transport resolution in
 * `get-email-context.ts` (best-effort fallback, alertable log on misconfig).
 */
export const getWhatsappContext = async (
  options: GetWhatsappContextOptions,
): Promise<WhatsappContext> => {
  const organisation =
    options.type === 'organisation'
      ? await prisma.organisation.findFirst({
          where: { id: options.organisationId },
          include: { organisationClaim: true },
        })
      : await prisma.team
          .findFirst({
            where: { id: options.teamId },
            include: { organisation: { include: { organisationClaim: true } } },
          })
          .then((team) => team?.organisation ?? null);

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND);
  }

  const whatsappTransportId = organisation.organisationClaim.whatsappTransportId;

  // Resolution order: the organisation's own transport (claim) → the global
  // default transport (`isDefault`) → the CapivaApp env default.
  const resolution = whatsappTransportId
    ? await resolveWhatsappTransport(whatsappTransportId)
    : await resolveDefaultWhatsappTransport();

  // A configured transport that fails to resolve is an operational problem, not
  // "no transport". Surface it before silently falling back to the env default.
  if (whatsappTransportId && !resolution) {
    logger.error({
      msg: 'Configured WhatsApp transport could not be resolved; falling back to the default transport',
      whatsappTransportId,
      organisationId: organisation.id,
    });
  }

  if (resolution) {
    return {
      organisationId: organisation.id,
      adapter: resolution.adapter,
      fromName: resolution.row.fromName,
      kind: 'own',
      enabled: true,
    };
  }

  const fallback = buildDefaultWhatsappAdapter();

  return {
    organisationId: organisation.id,
    adapter: fallback ?? noopAdapter,
    fromName: DEFAULT_FROM_NAME,
    kind: 'capiva',
    enabled: fallback !== null,
  };
};

/**
 * The CapivaApp default Z-API transport, from env. Returns null when not
 * configured so callers can skip sending instead of failing.
 */
const buildDefaultWhatsappAdapter = (): WhatsappAdapter | null => {
  const instanceId = env('NEXT_PRIVATE_WHATSAPP_ZAPI_INSTANCE_ID');
  const token = env('NEXT_PRIVATE_WHATSAPP_ZAPI_TOKEN');

  if (!instanceId || !token) {
    return null;
  }

  return createZapiAdapter({
    type: 'ZAPI',
    instanceId,
    token,
    clientToken: env('NEXT_PRIVATE_WHATSAPP_ZAPI_CLIENT_TOKEN') || undefined,
    baseUrl: env('NEXT_PRIVATE_WHATSAPP_ZAPI_BASE_URL') || undefined,
  });
};

const noopAdapter: WhatsappAdapter = {
  async sendMessage() {
    throw new AppError(AppErrorCode.NOT_SETUP, {
      message: 'No WhatsApp transport is configured for this organisation.',
    });
  },
};
