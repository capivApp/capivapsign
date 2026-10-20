import { PDF } from '@libpdf/core';
import { describe, expect, it, vi } from 'vitest';

import { renderBillingStatementPdf } from './render-billing-statement-pdf';

// Fonts live in the web app's public folder; the system fallback is enough to
// check the document structure.
vi.mock('../pdf/helpers', () => ({ ensureFontLibrary: vi.fn() }));

const STATEMENT = {
  period: '2026-10',
  issuedAt: new Date('2026-11-01T12:00:00Z'),
  dueDate: '2026-11-06',
  organisationName: 'Capivapp',
  payer: { name: 'Capivapp Ltda', document: '11222333000181', email: 'financeiro@capivapp.com.br' },
  invoiceUrl: 'https://www.asaas.com/i/abc123',
  items: [
    { description: 'Plano Equipe', quantity: 1, unitPriceCents: 14990, amountCents: 14990 },
    { description: 'Documentos criados', quantity: 120, unitPriceCents: 50, amountCents: 6000 },
  ],
};

const buildItems = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    description: `Item ${index}`,
    quantity: 1,
    unitPriceCents: 100,
    amountCents: 100,
  }));

describe('renderBillingStatementPdf', () => {
  it('renders a one page PDF', async () => {
    const bytes = await renderBillingStatementPdf(STATEMENT);

    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');

    const pdf = await PDF.load(bytes);

    expect(pdf.getPageCount()).toBe(1);
  });

  it('continues on new pages when the items do not fit', async () => {
    const bytes = await renderBillingStatementPdf({ ...STATEMENT, items: buildItems(80) });

    const pdf = await PDF.load(bytes);

    expect(pdf.getPageCount()).toBeGreaterThan(1);
  });
});
