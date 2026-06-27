import { fetchWithTimeout } from '../../../utils/timeout';
import type { ZZapiConfigSchema } from '../whatsapp-transport-config';
import type { WhatsappAdapter, WhatsappSendInput, WhatsappSendResult } from './whatsapp-adapter';
import { z } from 'zod';

type ZapiConfig = z.infer<typeof ZZapiConfigSchema>;

const DEFAULT_BASE_URL = 'https://api.z-api.io';
const SEND_TIMEOUT_MS = 10_000;

/** Keep only digits — Z-API expects a bare phone (country code + number). */
const normalisePhone = (phone: string): string => phone.replace(/\D/g, '');

/**
 * Z-API text adapter. Endpoint:
 *   POST {baseUrl}/instances/{instanceId}/token/{token}/send-text
 * with an optional account-level `Client-Token` header and `{ phone, message }`.
 */
export const createZapiAdapter = (config: ZapiConfig): WhatsappAdapter => {
  const baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');

  return {
    async sendMessage(input: WhatsappSendInput): Promise<WhatsappSendResult> {
      const url = `${baseUrl}/instances/${config.instanceId}/token/${config.token}/send-text`;

      const response = await fetchWithTimeout(url, {
        method: 'POST',
        timeoutMs: SEND_TIMEOUT_MS,
        headers: {
          'Content-Type': 'application/json',
          ...(config.clientToken ? { 'Client-Token': config.clientToken } : {}),
        },
        body: JSON.stringify({ phone: normalisePhone(input.to), message: input.body }),
      });

      const text = await response.text();

      if (!response.ok) {
        throw new Error(`Z-API send failed (${response.status}): ${text}`);
      }

      const messageId = z
        .object({ messageId: z.string() })
        .safeParse(JSON.parse(text || '{}'));

      return { providerMessageId: messageId.success ? messageId.data.messageId : undefined };
    },
  };
};
