import { prisma } from '@documenso/prisma';
import { BillableEventType, UsageInvoiceStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AsaasClient } from '../asaas/asaas-client';
import { chargeOrganisationMonthlyUsage } from './charge-monthly-usage';
import { renderBillingStatementPdf } from './render-billing-statement-pdf';

vi.mock('@documenso/prisma', () => ({
  prisma: {
    organisation: { findUniqueOrThrow: vi.fn() },
    subscriptionClaim: { findUnique: vi.fn() },
    usageEvent: { groupBy: vi.fn() },
    usageInvoice: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('./render-billing-statement-pdf', () => ({
  renderBillingStatementPdf: vi.fn(async () => new Uint8Array([37, 80, 68, 70])),
}));

const ORGANISATION = {
  id: 'org_1',
  name: 'Capivapp',
  customerId: 'cus_1',
  billingName: 'Capivapp Ltda',
  billingDocument: '11222333000181',
  billingEmail: 'financeiro@capivapp.com.br',
  organisationClaim: { originalSubscriptionClaimId: 'team', pricing: { monthlyPriceCents: 14990 } },
  subscription: null as { discountPercent: number } | null,
};

const mockDiscount = (discountPercent: number) => {
  vi.mocked(prisma.organisation.findUniqueOrThrow).mockResolvedValue({
    ...ORGANISATION,
    subscription: { discountPercent },
  } as never);
};

const USAGE = [
  { type: BillableEventType.CREATE_DOCUMENT, unitPriceCents: 50, _sum: { amountCents: 6000 } },
  { type: BillableEventType.EMAIL_MESSAGE, unitPriceCents: 2, _sum: { amountCents: 0 } },
];

const NOW = new Date('2026-11-01T12:00:00Z');

const createFakeAsaas = () => ({
  createPayment: vi.fn(async () => ({ id: 'pay_1', invoiceUrl: 'https://asaas/i/pay_1', status: 'PENDING' })),
  uploadPaymentDocument: vi.fn(async () => ({ id: 'doc_1' })),
});

const charge = (asaas: ReturnType<typeof createFakeAsaas>, overrides: { dryRun?: boolean } = {}) =>
  chargeOrganisationMonthlyUsage({
    organisationId: 'org_1',
    year: 2026,
    month: 10,
    now: NOW,
    asaas: asaas as unknown as AsaasClient,
    ...overrides,
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.organisation.findUniqueOrThrow).mockResolvedValue(ORGANISATION as never);
  vi.mocked(prisma.subscriptionClaim.findUnique).mockResolvedValue({ name: 'Equipe' } as never);
  vi.mocked(prisma.usageEvent.groupBy).mockResolvedValue(USAGE as never);
  vi.mocked(prisma.usageInvoice.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.usageInvoice.create).mockResolvedValue({ id: 'usage_invoice_1' } as never);
});

describe('chargeOrganisationMonthlyUsage', () => {
  it('previews the itemised bill without touching Asaas or saving it', async () => {
    const asaas = createFakeAsaas();

    const breakdown = await charge(asaas, { dryRun: true });

    expect(breakdown).toMatchObject({
      period: '2026-10',
      monthlyPriceCents: 14990,
      meteredCents: 6000,
      totalCents: 20990,
      items: [
        { description: 'Plano Equipe', quantity: 1, unitPriceCents: 14990, amountCents: 14990 },
        { description: 'Documentos criados', quantity: 120, unitPriceCents: 50, amountCents: 6000 },
      ],
    });
    expect(asaas.createPayment).not.toHaveBeenCalled();
    expect(prisma.usageInvoice.create).not.toHaveBeenCalled();
  });

  it('saves the bill with its items and issues one Asaas charge for the total', async () => {
    const asaas = createFakeAsaas();

    await charge(asaas);

    expect(prisma.usageInvoice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organisationId: 'org_1',
        period: '2026-10',
        monthlyPriceCents: 14990,
        meteredCents: 6000,
        totalCents: 20990,
        items: {
          create: [
            expect.objectContaining({ position: 0, description: 'Plano Equipe', amountCents: 14990 }),
            expect.objectContaining({ position: 1, description: 'Documentos criados', quantity: 120 }),
          ],
        },
      }),
    });

    expect(asaas.createPayment).toHaveBeenCalledWith({
      customer: 'cus_1',
      billingType: 'UNDEFINED',
      value: 209.9,
      dueDate: '2026-11-06',
      description: expect.stringContaining('Plano Equipe: R$ 149,90'),
      externalReference: 'usage_invoice_1',
    });

    expect(prisma.usageInvoice.update).toHaveBeenCalledWith({
      where: { id: 'usage_invoice_1' },
      data: { asaasPaymentId: 'pay_1', invoiceUrl: 'https://asaas/i/pay_1', dueDate: new Date('2026-11-06') },
    });
  });

  it('attaches the itemised statement to the charge', async () => {
    const asaas = createFakeAsaas();

    await charge(asaas);

    expect(renderBillingStatementPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        period: '2026-10',
        dueDate: '2026-11-06',
        invoiceUrl: 'https://asaas/i/pay_1',
        payer: { name: 'Capivapp Ltda', document: '11222333000181', email: 'financeiro@capivapp.com.br' },
      }),
    );
    expect(asaas.uploadPaymentDocument).toHaveBeenCalledWith('pay_1', {
      file: expect.any(Uint8Array),
      fileName: 'demonstrativo-2026-10.pdf',
      type: 'INVOICE',
      availableAfterPayment: false,
    });
  });

  it('keeps the charge when the statement upload fails', async () => {
    const asaas = createFakeAsaas();
    asaas.uploadPaymentDocument.mockRejectedValue(new Error('upload failed'));

    await expect(charge(asaas)).resolves.toMatchObject({ totalCents: 20990 });
    expect(prisma.usageInvoice.update).toHaveBeenCalled();
  });

  it('does not bill the same month twice', async () => {
    vi.mocked(prisma.usageInvoice.findUnique).mockResolvedValue({
      id: 'usage_invoice_1',
      asaasPaymentId: 'pay_1',
    } as never);
    const asaas = createFakeAsaas();

    await charge(asaas);

    expect(prisma.usageInvoice.create).not.toHaveBeenCalled();
    expect(asaas.createPayment).not.toHaveBeenCalled();
  });

  it('retries the Asaas charge for a saved bill that never got one', async () => {
    vi.mocked(prisma.usageInvoice.findUnique).mockResolvedValue({
      id: 'usage_invoice_1',
      asaasPaymentId: null,
    } as never);
    const asaas = createFakeAsaas();

    await charge(asaas);

    expect(prisma.usageInvoice.create).not.toHaveBeenCalled();
    expect(asaas.createPayment).toHaveBeenCalledWith(expect.objectContaining({ externalReference: 'usage_invoice_1' }));
  });

  it('saves the bill but leaves it unpaid when the organisation has no Asaas customer', async () => {
    vi.mocked(prisma.organisation.findUniqueOrThrow).mockResolvedValue({ ...ORGANISATION, customerId: null } as never);
    const asaas = createFakeAsaas();

    await charge(asaas);

    expect(prisma.usageInvoice.create).toHaveBeenCalled();
    expect(asaas.createPayment).not.toHaveBeenCalled();
  });

  it('does nothing when there is nothing to charge', async () => {
    vi.mocked(prisma.organisation.findUniqueOrThrow).mockResolvedValue({
      ...ORGANISATION,
      organisationClaim: { originalSubscriptionClaimId: 'free', pricing: {} },
    } as never);
    vi.mocked(prisma.usageEvent.groupBy).mockResolvedValue([]);
    const asaas = createFakeAsaas();

    await expect(charge(asaas)).resolves.toMatchObject({ totalCents: 0, items: [] });
    expect(prisma.usageInvoice.create).not.toHaveBeenCalled();
  });

  it('records a fully discounted bill without charging it', async () => {
    mockDiscount(100);
    const asaas = createFakeAsaas();

    const breakdown = await charge(asaas);

    expect(breakdown).toMatchObject({ totalCents: 0, discountCents: 20990 });
    expect(prisma.usageInvoice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        totalCents: 0,
        status: UsageInvoiceStatus.WAIVED,
        items: {
          create: expect.arrayContaining([
            expect.objectContaining({ description: 'Desconto (100%)', amountCents: -20990 }),
          ]),
        },
      }),
    });
    expect(asaas.createPayment).not.toHaveBeenCalled();
  });

  it('charges only the discounted total', async () => {
    mockDiscount(50);
    const asaas = createFakeAsaas();

    await charge(asaas);

    expect(asaas.createPayment).toHaveBeenCalledWith(expect.objectContaining({ value: 104.95 }));
  });

  it('shows the discount in the preview', async () => {
    mockDiscount(100);

    const breakdown = await charge(createFakeAsaas(), { dryRun: true });

    expect(breakdown.items.at(-1)).toMatchObject({ description: 'Desconto (100%)' });
    expect(prisma.usageInvoice.create).not.toHaveBeenCalled();
  });
});
