import { prisma } from '@documenso/prisma';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { syncUsageInvoicePayment } from '../../billing/sync-usage-invoice-payment';
import { handleAsaasWebhook } from './handle-asaas-webhook';

vi.mock('@documenso/prisma', () => ({
  prisma: { asaasWebhookEvent: { findUnique: vi.fn(), upsert: vi.fn() } },
}));

vi.mock('../../billing/sync-usage-invoice-payment', () => ({
  syncUsageInvoicePayment: vi.fn(),
}));

const TOKEN = 'webhook-token';

const buildRequest = (body: unknown, token: string | null = TOKEN) =>
  new Request('https://assina.capivapp.com.br/api/asaas/webhook', {
    method: 'POST',
    headers: token === null ? {} : { 'asaas-access-token': token },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const PAYMENT_EVENT = { id: 'evt_1', event: 'PAYMENT_RECEIVED', payment: { id: 'pay_1', status: 'RECEIVED' } };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_FEATURE_BILLING_ENABLED', 'true');
  vi.stubEnv('NEXT_PRIVATE_ASAAS_WEBHOOK_TOKEN', TOKEN);
  vi.mocked(prisma.asaasWebhookEvent.findUnique).mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('handleAsaasWebhook', () => {
  it('acknowledges and ignores events while billing is switched off', async () => {
    vi.stubEnv('NEXT_PUBLIC_FEATURE_BILLING_ENABLED', '');

    const response = await handleAsaasWebhook(buildRequest(PAYMENT_EVENT));

    expect(response.status).toBe(200);
    expect(syncUsageInvoicePayment).not.toHaveBeenCalled();
  });

  it('fails loudly when the webhook token is not configured', async () => {
    vi.stubEnv('NEXT_PRIVATE_ASAAS_WEBHOOK_TOKEN', '');

    const response = await handleAsaasWebhook(buildRequest(PAYMENT_EVENT));

    expect(response.status).toBe(500);
  });

  it('rejects requests without the right token', async () => {
    expect((await handleAsaasWebhook(buildRequest(PAYMENT_EVENT, null))).status).toBe(401);
    expect((await handleAsaasWebhook(buildRequest(PAYMENT_EVENT, 'wrong'))).status).toBe(401);
    expect(syncUsageInvoicePayment).not.toHaveBeenCalled();
  });

  it('rejects malformed bodies', async () => {
    expect((await handleAsaasWebhook(buildRequest('not json'))).status).toBe(400);
    expect((await handleAsaasWebhook(buildRequest({ event: 'PAYMENT_RECEIVED' }))).status).toBe(400);
  });

  it('acknowledges events that are not about payments', async () => {
    const response = await handleAsaasWebhook(buildRequest({ id: 'evt_2', event: 'SUBSCRIPTION_CREATED' }));

    expect(response.status).toBe(200);
    expect(syncUsageInvoicePayment).not.toHaveBeenCalled();
  });

  it('syncs the bill of a payment event and records the event', async () => {
    const response = await handleAsaasWebhook(buildRequest(PAYMENT_EVENT));

    expect(response.status).toBe(200);
    expect(syncUsageInvoicePayment).toHaveBeenCalledWith({ paymentId: 'pay_1', isDeleted: false });
    expect(prisma.asaasWebhookEvent.upsert).toHaveBeenCalledWith({
      where: { id: 'evt_1' },
      create: { id: 'evt_1', event: 'PAYMENT_RECEIVED' },
      update: {},
    });
  });

  it('flags deleted payments', async () => {
    await handleAsaasWebhook(buildRequest({ ...PAYMENT_EVENT, id: 'evt_3', event: 'PAYMENT_DELETED' }));

    expect(syncUsageInvoicePayment).toHaveBeenCalledWith({ paymentId: 'pay_1', isDeleted: true });
  });

  it('skips events it already handled', async () => {
    vi.mocked(prisma.asaasWebhookEvent.findUnique).mockResolvedValue({ id: 'evt_1' } as never);

    const response = await handleAsaasWebhook(buildRequest(PAYMENT_EVENT));

    expect(response.status).toBe(200);
    expect(syncUsageInvoicePayment).not.toHaveBeenCalled();
  });

  it('asks Asaas to retry when the sync fails, without recording the event', async () => {
    vi.mocked(syncUsageInvoicePayment).mockRejectedValue(new Error('Asaas unavailable'));

    const response = await handleAsaasWebhook(buildRequest(PAYMENT_EVENT));

    expect(response.status).toBe(500);
    expect(prisma.asaasWebhookEvent.upsert).not.toHaveBeenCalled();
  });
});
