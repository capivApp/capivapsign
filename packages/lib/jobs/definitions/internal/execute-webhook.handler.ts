import { recordUsage } from '@documenso/lib/server-only/billing/record-usage';
import { executeWebhookCall } from '@documenso/lib/server-only/webhooks/execute-webhook-call';
import { prisma } from '@documenso/prisma';
import type { Prisma } from '@prisma/client';
import { BillableEventType, WebhookCallStatus } from '@prisma/client';

import type { JobRunIO } from '../../client/_internal/job';
import type { TExecuteWebhookJobDefinition } from './execute-webhook';

/**
 * Automatic delivery attempts before the webhook is left to manual resend.
 * Retries happen IN this handler (deterministic across job clients), and we
 * return normally on final failure so the job framework does NOT add its own
 * retries on top. Each attempt is recorded as a WebhookCall (visible in the log)
 * and the manual `webhook.calls.resend` route re-runs this job from scratch.
 */
const MAX_AUTO_ATTEMPTS = 3;

/** Linear backoff between automatic attempts (ms): 2s, 4s. */
const RETRY_BACKOFF_MS = 2000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const run = async ({ payload, io }: { payload: TExecuteWebhookJobDefinition; io: JobRunIO }) => {
  const { event, webhookId, data } = payload;

  const webhook = await prisma.webhook.findUniqueOrThrow({
    where: { id: webhookId },
  });

  const { webhookUrl: url, secret } = webhook;

  const payloadData = {
    event,
    payload: data,
    createdAt: new Date().toISOString(),
    webhookEndpoint: url,
  };

  for (let attempt = 1; attempt <= MAX_AUTO_ATTEMPTS; attempt++) {
    const result = await executeWebhookCall({ url, body: payloadData, secret });

    // Record every attempt so the delivery log shows the full retry history.
    await prisma.webhookCall.create({
      data: {
        url,
        event,
        status: result.success ? WebhookCallStatus.SUCCESS : WebhookCallStatus.FAILED,
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        requestBody: payloadData as Prisma.InputJsonValue,
        responseCode: result.responseCode,
        responseBody: result.responseBody,
        responseHeaders: result.responseHeaders,
        webhookId: webhook.id,
      },
    });

    if (result.success) {
      // Bill the delivery to the org (integration usage, billed regardless of
      // the originating source). Only successful deliveries are charged.
      await recordUsage({
        type: BillableEventType.WEBHOOK_DELIVERY,
        source: 'apiV1',
        alwaysBill: true,
        teamId: webhook.teamId,
        userId: webhook.userId,
        metadata: { event, webhookId: webhook.id, attempt },
      });

      return { success: true, status: result.responseCode, attempt };
    }

    io.logger.warn({
      msg: 'Webhook delivery attempt failed',
      webhookId: webhook.id,
      event,
      attempt,
      responseCode: result.responseCode,
    });

    if (attempt < MAX_AUTO_ATTEMPTS) {
      await wait(RETRY_BACKOFF_MS * attempt);
    }
  }

  // All automatic attempts exhausted. Return normally (do NOT throw) so the job
  // framework doesn't retry further — from here the delivery is manual-only via
  // `webhook.calls.resend`.
  io.logger.error({
    msg: 'Webhook delivery failed after all automatic attempts; manual resend required',
    webhookId: webhook.id,
    event,
    attempts: MAX_AUTO_ATTEMPTS,
  });

  return { success: false, attempts: MAX_AUTO_ATTEMPTS };
};
