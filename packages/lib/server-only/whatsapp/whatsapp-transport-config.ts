import { z } from 'zod';

import { DOCUMENSO_ENCRYPTION_SECONDARY_KEY } from '../../constants/crypto';
import { symmetricDecrypt, symmetricEncrypt } from '../../universal/crypto';

/**
 * WhatsApp transport config — mirrors the email transport config
 * (`server-only/email/email-transport-config.ts`): a discriminated union by
 * `type`, stored as an encrypted JSON blob, with secret fields stripped before
 * returning to the client.
 *
 * Pluggable by design: add a provider by adding a `Z*ConfigSchema` + a `type`
 * literal here and a matching adapter in `build-whatsapp-transport.ts`.
 */

/**
 * Config keys holding secrets across all transport types. On update an empty
 * incoming value means "keep the existing secret" — same contract as email.
 *
 * Keep in sync with the fields marked `Secret` in the schemas below.
 */
export const WHATSAPP_TRANSPORT_SECRET_KEYS = ['token', 'clientToken'] as const;

export const ZZapiConfigSchema = z.object({
  type: z.literal('ZAPI'),
  instanceId: z.string().min(1),
  token: z.string().min(1), // Secret — keep in sync with WHATSAPP_TRANSPORT_SECRET_KEYS.
  clientToken: z.string().optional(), // Secret — account-level security token.
  baseUrl: z.string().url().optional(), // Defaults to https://api.z-api.io
});

export const ZWhatsappTransportConfigSchema = z.discriminatedUnion('type', [ZZapiConfigSchema]);

export type TWhatsappTransportConfig = z.infer<typeof ZWhatsappTransportConfigSchema>;

/**
 * Non-secret view of a transport config — safe to return to the client so the
 * edit form can pre-fill connection settings without exposing secrets.
 */
export const ZWhatsappTransportPublicConfigSchema = z.discriminatedUnion('type', [
  ZZapiConfigSchema.omit({ token: true, clientToken: true }),
]);

export type TWhatsappTransportPublicConfig = z.infer<typeof ZWhatsappTransportPublicConfigSchema>;

export const toPublicWhatsappTransportConfig = (
  config: TWhatsappTransportConfig,
): TWhatsappTransportPublicConfig => {
  const publicConfig: Record<string, unknown> = { ...config };

  for (const key of WHATSAPP_TRANSPORT_SECRET_KEYS) {
    delete publicConfig[key];
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return publicConfig as TWhatsappTransportPublicConfig;
};

export const encryptWhatsappTransportConfig = (config: TWhatsappTransportConfig): string => {
  if (!DOCUMENSO_ENCRYPTION_SECONDARY_KEY) {
    throw new Error('Missing encryption key');
  }

  return symmetricEncrypt({
    key: DOCUMENSO_ENCRYPTION_SECONDARY_KEY,
    data: JSON.stringify(config),
  });
};

export const decryptWhatsappTransportConfig = (encrypted: string): TWhatsappTransportConfig => {
  if (!DOCUMENSO_ENCRYPTION_SECONDARY_KEY) {
    throw new Error('Missing encryption key');
  }

  const decrypted = Buffer.from(
    symmetricDecrypt({ key: DOCUMENSO_ENCRYPTION_SECONDARY_KEY, data: encrypted }),
  ).toString('utf-8');

  return ZWhatsappTransportConfigSchema.parse(JSON.parse(decrypted));
};
