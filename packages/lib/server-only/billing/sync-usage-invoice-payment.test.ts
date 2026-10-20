import { prisma } from '@documenso/prisma';
import { SubscriptionStatus, UsageInvoiceStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AsaasClient } from '../asaas/asaas-client';
import type { AsaasPaymentStatus } from '../asaas/types';
import { mapAsaasPaymentStatus, syncUsageInvoicePayment } from './sync-usage-invoice-payment';

vi.mock('@documenso/prisma', () => ({
  prisma: {
    usageInvoice: { findUnique: vi.fn(), update: vi.fn(), count: vi.fn() },
    subscription: { upsert: vi.fn() },
  },
}));

const INVOICE = { id: 'usage_invoice_1', organisationId: 'org_1', paidAt: null };

const createFakeAsaas = (status: AsaasPaymentStatus) => ({
  getPayment: vi.fn(async () => ({ id: 'pay_1', status })),
});

const sync = (asaas: ReturnType<typeof createFakeAsaas>, isDeleted = false) =>
  syncUsageInvoicePayment({
    paymentId: 'pay_1',
    isDeleted,
    now: new Date('2026-11-04T10:00:00Z'),
    asaas: asaas as unknown as AsaasClient,
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.usageInvoice.findUnique).mockResolvedValue(INVOICE as never);
  vi.mocked(prisma.usageInvoice.count).mockResolvedValue(0);
});

describe('mapAsaasPaymentStatus', () => {
  it('treats received, confirmed and cash payments as paid', () => {
    expect(mapAsaasPaymentStatus('RECEIVED')).toBe(UsageInvoiceStatus.PAID);
    expect(mapAsaasPaymentStatus('CONFIRMED')).toBe(UsageInvoiceStatus.PAID);
    expect(mapAsaasPaymentStatus('RECEIVED_IN_CASH')).toBe(UsageInvoiceStatus.PAID);
    expect(mapAsaasPaymentStatus('DUNNING_RECEIVED')).toBe(UsageInvoiceStatus.PAID);
  });

  it('treats overdue and charged back payments as overdue', () => {
    expect(mapAsaasPaymentStatus('OVERDUE')).toBe(UsageInvoiceStatus.OVERDUE);
    expect(mapAsaasPaymentStatus('DUNNING_REQUESTED')).toBe(UsageInvoiceStatus.OVERDUE);
    expect(mapAsaasPaymentStatus('CHARGEBACK_REQUESTED')).toBe(UsageInvoiceStatus.OVERDUE);
  });

  it('treats refunds as cancelled and everything else as pending', () => {
    expect(mapAsaasPaymentStatus('REFUNDED')).toBe(UsageInvoiceStatus.CANCELLED);
    expect(mapAsaasPaymentStatus('PENDING')).toBe(UsageInvoiceStatus.PENDING);
    expect(mapAsaasPaymentStatus('AWAITING_RISK_ANALYSIS')).toBe(UsageInvoiceStatus.PENDING);
  });
});

describe('syncUsageInvoicePayment', () => {
  it('ignores payments that are not CapivaSign bills', async () => {
    vi.mocked(prisma.usageInvoice.findUnique).mockResolvedValue(null);
    const asaas = createFakeAsaas('RECEIVED');

    await sync(asaas);

    expect(asaas.getPayment).not.toHaveBeenCalled();
    expect(prisma.usageInvoice.update).not.toHaveBeenCalled();
  });

  it('reads the current payment from Asaas and marks the bill as paid', async () => {
    const asaas = createFakeAsaas('RECEIVED');

    await sync(asaas);

    expect(asaas.getPayment).toHaveBeenCalledWith('pay_1');
    expect(prisma.usageInvoice.update).toHaveBeenCalledWith({
      where: { id: 'usage_invoice_1' },
      data: { status: UsageInvoiceStatus.PAID, paidAt: new Date('2026-11-04T10:00:00Z') },
    });
  });

  it('keeps the first payment date', async () => {
    vi.mocked(prisma.usageInvoice.findUnique).mockResolvedValue({
      ...INVOICE,
      paidAt: new Date('2026-11-02T00:00:00Z'),
    } as never);

    await sync(createFakeAsaas('CONFIRMED'));

    expect(prisma.usageInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ paidAt: new Date('2026-11-02T00:00:00Z') }) }),
    );
  });

  it('cancels the bill when the payment was deleted, without asking Asaas', async () => {
    const asaas = createFakeAsaas('PENDING');

    await sync(asaas, true);

    expect(asaas.getPayment).not.toHaveBeenCalled();
    expect(prisma.usageInvoice.update).toHaveBeenCalledWith({
      where: { id: 'usage_invoice_1' },
      data: { status: UsageInvoiceStatus.CANCELLED, paidAt: null },
    });
  });

  it('blocks the organisation while any bill is overdue', async () => {
    vi.mocked(prisma.usageInvoice.count).mockResolvedValue(1);

    await sync(createFakeAsaas('OVERDUE'));

    expect(prisma.usageInvoice.count).toHaveBeenCalledWith({
      where: { organisationId: 'org_1', status: UsageInvoiceStatus.OVERDUE },
    });
    expect(prisma.subscription.upsert).toHaveBeenCalledWith({
      where: { organisationId: 'org_1' },
      create: { organisationId: 'org_1', status: SubscriptionStatus.INACTIVE },
      update: { status: SubscriptionStatus.INACTIVE },
    });
  });

  it('unblocks the organisation once nothing is overdue', async () => {
    await sync(createFakeAsaas('RECEIVED'));

    expect(prisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { status: SubscriptionStatus.ACTIVE } }),
    );
  });
});
