import { BillableEventType } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  buildInvoiceDescription,
  buildMonthlyInvoiceItems,
  formatBrl,
  formatPeriod,
  formatQuantity,
  getInvoiceDueDate,
} from './build-monthly-invoice';

describe('formatBrl', () => {
  it('formats cents as reais with a plain space', () => {
    expect(formatBrl(14990)).toBe('R$ 149,90');
    expect(formatBrl(5)).toBe('R$ 0,05');
    expect(formatBrl(123456789)).toBe('R$ 1.234.567,89');
  });
});

describe('formatQuantity', () => {
  it('groups thousands the Brazilian way', () => {
    expect(formatQuantity(4380)).toBe('4.380');
    expect(formatQuantity(12)).toBe('12');
  });
});

describe('formatPeriod', () => {
  it('turns YYYY-MM into MM/YYYY', () => {
    expect(formatPeriod('2026-10')).toBe('10/2026');
  });
});

describe('buildMonthlyInvoiceItems', () => {
  it('puts the plan fee first and one line per usage category and price', () => {
    const items = buildMonthlyInvoiceItems({
      planName: 'Equipe',
      monthlyPriceCents: 14990,
      usage: [
        { type: BillableEventType.WHATSAPP_MESSAGE, unitPriceCents: 30, amountCents: 300 },
        { type: BillableEventType.CREATE_DOCUMENT, unitPriceCents: 50, amountCents: 6000 },
        { type: BillableEventType.WHATSAPP_MESSAGE, unitPriceCents: 10, amountCents: 50 },
      ],
    });

    expect(items).toEqual([
      { description: 'Plano Equipe', quantity: 1, unitPriceCents: 14990, amountCents: 14990 },
      { description: 'Documentos criados', quantity: 120, unitPriceCents: 50, amountCents: 6000 },
      { description: 'Mensagens de WhatsApp', quantity: 10, unitPriceCents: 30, amountCents: 300 },
      { description: 'Mensagens de WhatsApp', quantity: 5, unitPriceCents: 10, amountCents: 50 },
    ]);
  });

  it('leaves out free plans and usage within the free allowance', () => {
    const items = buildMonthlyInvoiceItems({
      planName: 'Gratuito',
      monthlyPriceCents: 0,
      usage: [
        { type: BillableEventType.EMAIL_MESSAGE, unitPriceCents: 2, amountCents: 0 },
        { type: BillableEventType.WEBHOOK_DELIVERY, unitPriceCents: 0, amountCents: 0 },
      ],
    });

    expect(items).toEqual([]);
  });
});

describe('buildInvoiceDescription', () => {
  it('summarises every line', () => {
    const description = buildInvoiceDescription({
      period: '2026-10',
      items: [
        { description: 'Plano Equipe', quantity: 1, unitPriceCents: 14990, amountCents: 14990 },
        { description: 'Documentos criados', quantity: 120, unitPriceCents: 50, amountCents: 6000 },
      ],
    });

    expect(description).toBe(
      'CapivaSign 10/2026. Plano Equipe: R$ 149,90. Documentos criados: 120 x R$ 0,50 = R$ 60,00. ' +
        'Detalhes no demonstrativo anexo.',
    );
  });

  it('never exceeds the 500 characters Asaas accepts', () => {
    const items = Array.from({ length: 40 }, (_, index) => ({
      description: `Item de uso número ${index}`,
      quantity: 1000,
      unitPriceCents: 99,
      amountCents: 99000,
    }));

    const description = buildInvoiceDescription({ period: '2026-10', items });

    expect(description.length).toBeLessThanOrEqual(500);
    expect(description.endsWith('Detalhes no demonstrativo anexo.')).toBe(true);
    expect(description).toMatch(/E mais \d+ itens\./);
  });
});

describe('getInvoiceDueDate', () => {
  it('is five days after the issue date in Brasília time', () => {
    // 1 Nov 02:00 UTC is still 31 Oct in Brasília (UTC-3).
    expect(getInvoiceDueDate(new Date('2026-11-01T02:00:00Z'))).toBe('2026-11-05');
    expect(getInvoiceDueDate(new Date('2026-11-01T12:00:00Z'))).toBe('2026-11-06');
  });
});
