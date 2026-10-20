import { timingSafeEqual } from 'node:crypto';

import { prisma } from '@documenso/prisma';
import { z } from 'zod';

import { IS_BILLING_ENABLED } from '../../../constants/app';
import { env } from '../../../utils/env';
import { logger } from '../../../utils/logger';
import { syncUsageInvoicePayment } from '../../billing/sync-usage-invoice-payment';

// Asaas adds fields over time; only what we read is validated.
const ZAsaasWebhookEventSchema = z.object({
  id: z.string(),
  event: z.string(),
  payment: z.object({ id: z.string() }).optional(),
});

type AsaasWebhookEvent = z.infer<typeof ZAsaasWebhookEventSchema>;

const respond = (status: number, message: string) => Response.json({ message }, { status });

const isTokenValid = (received: string | null, expected: string) => {
  const receivedBuffer = Buffer.from(received ?? '');
  const expectedBuffer = Buffer.from(expected);

  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
};

const parseEvent = async (request: Request) => {
  const body: unknown = await request.json().catch(() => null);

  return ZAsaasWebhookEventSchema.safeParse(body);
};

const isAlreadyHandled = async (eventId: string) =>
  Boolean(await prisma.asaasWebhookEvent.findUnique({ where: { id: eventId }, select: { id: true } }));

const handlePaymentEvent = async (event: AsaasWebhookEvent, paymentId: string) => {
  await syncUsageInvoicePayment({ paymentId, isDeleted: event.event === 'PAYMENT_DELETED' });

  await prisma.asaasWebhookEvent.upsert({
    where: { id: event.id },
    create: { id: event.id, event: event.event },
    update: {},
  });
};

/**
 * Receives Asaas webhooks at POST /api/asaas/webhook. Only payment events
 * matter: each one re-syncs the bill it belongs to (and with it whether the
 * organisation is blocked). Any non-2xx makes Asaas deliver the event again.
 */
export const handleAsaasWebhook = async (request: Request): Promise<Response> => {
  if (!IS_BILLING_ENABLED()) {
    return respond(200, 'Billing is disabled');
  }

  const expectedToken = env('NEXT_PRIVATE_ASAAS_WEBHOOK_TOKEN');

  if (!expectedToken) {
    logger.error({ msg: 'NEXT_PRIVATE_ASAAS_WEBHOOK_TOKEN is not set; Asaas webhooks are rejected' });
    return respond(500, 'Webhook token is not configured');
  }

  if (!isTokenValid(request.headers.get('asaas-access-token'), expectedToken)) {
    return respond(401, 'Invalid token');
  }

  const parsed = await parseEvent(request);

  if (!parsed.success) {
    return respond(400, 'Invalid event');
  }

  const event = parsed.data;
  const paymentId = event.payment?.id;

  if (!event.event.startsWith('PAYMENT_') || !paymentId) {
    return respond(200, 'Ignored');
  }

  if (await isAlreadyHandled(event.id)) {
    return respond(200, 'Already handled');
  }

  try {
    await handlePaymentEvent(event, paymentId);
  } catch (err) {
    logger.error({ msg: 'Asaas webhook handling failed', eventId: event.id, err });
    return respond(500, 'Handling failed');
  }

  return respond(200, 'OK');
};
