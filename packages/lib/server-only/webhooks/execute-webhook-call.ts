import type { Prisma } from '@prisma/client';

import { fetchWithTimeout } from '../../utils/timeout';
import { assertNotPrivateUrl } from './assert-webhook-url';

const WEBHOOK_TIMEOUT_MS = 10_000;

/**
 * Header carrying the per-webhook shared secret, which the receiver compares
 * against its stored copy to authenticate the call.
 *
 * Part of the public integration contract: changing it breaks every subscriber
 * that verifies it, so it must stay in sync with the webhook docs under
 * `apps/docs/content/docs/developers/webhooks/`.
 */
export const WEBHOOK_SECRET_HEADER = 'X-CapivaSign-Secret';

export type WebhookCallResult = {
  success: boolean;
  responseCode: number;
  responseBody: Prisma.InputJsonValue | Prisma.JsonNullValueInput;
  responseHeaders: Record<string, string>;
};

const parseBody = (text: string): Prisma.InputJsonValue => {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

export const executeWebhookCall = async (options: {
  url: string;
  body: unknown;
  secret: string | null;
}): Promise<WebhookCallResult> => {
  const { url, body, secret } = options;

  try {
    await assertNotPrivateUrl(url);

    const response = await fetchWithTimeout(url, {
      method: 'POST',
      body: JSON.stringify(body),
      redirect: 'manual',
      timeoutMs: WEBHOOK_TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
        [WEBHOOK_SECRET_HEADER]: secret ?? '',
      },
    });

    const text = await response.text();

    return {
      success: response.ok,
      responseCode: response.status,
      responseBody: parseBody(text),
      responseHeaders: Object.fromEntries(response.headers.entries()),
    };
  } catch (err) {
    return {
      success: false,
      responseCode: 0,
      responseBody: err instanceof Error ? err.message : 'Unknown error',
      responseHeaders: {},
    };
  }
};
