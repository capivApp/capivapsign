import Konva from 'konva';
import 'konva/skia-backend';
import { PDF } from '@libpdf/core';
import { DateTime } from 'luxon';
import type { Canvas } from 'skia-canvas';

import { formatCpfCnpj } from '../../utils/cpf-cnpj';
import { ensureFontLibrary } from '../pdf/helpers';
import { formatBrl, formatPeriod, formatQuantity, type MonthlyInvoiceItem } from './build-monthly-invoice';

export type BillingStatement = {
  period: string;
  issuedAt: Date;
  /** YYYY-MM-DD. */
  dueDate: string;
  organisationName: string;
  payer: { name: string; document: string; email: string };
  invoiceUrl: string;
  items: MonthlyInvoiceItem[];
};

// A4 in PDF points.
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const ROW_HEIGHT = 22;
const FIRST_PAGE_TABLE_TOP = 250;
const OTHER_PAGE_TABLE_TOP = MARGIN;
// Kept free at the bottom of every page for the total, payment note and footer.
const BOTTOM_RESERVED = 140;

const ROWS_ON_FIRST_PAGE = Math.floor((PAGE_HEIGHT - FIRST_PAGE_TABLE_TOP - ROW_HEIGHT - BOTTOM_RESERVED) / ROW_HEIGHT);
const ROWS_ON_OTHER_PAGES = Math.floor(
  (PAGE_HEIGHT - OTHER_PAGE_TABLE_TOP - ROW_HEIGHT - BOTTOM_RESERVED) / ROW_HEIGHT,
);

const COLOR_TEXT = '#0f172a';
const COLOR_MUTED = '#64748b';
const COLOR_BORDER = '#e2e8f0';
const COLOR_BRAND = '#4f46e5';
const COLOR_PANEL = '#f8fafc';

const FONT = 'Inter';

const COLUMNS = [
  { key: 'description', label: 'Descrição', width: 250, align: 'left' },
  { key: 'quantity', label: 'Qtd.', width: 60, align: 'right' },
  { key: 'unitPrice', label: 'Valor unitário', width: 92, align: 'right' },
  { key: 'amount', label: 'Total', width: 97, align: 'right' },
] as const;

type ColumnKey = (typeof COLUMNS)[number]['key'];

const CELL_VALUE: Record<ColumnKey, (item: MonthlyInvoiceItem) => string> = {
  description: (item) => item.description,
  quantity: (item) => formatQuantity(item.quantity),
  unitPrice: (item) => formatBrl(item.unitPriceCents),
  amount: (item) => formatBrl(item.amountCents),
};

const formatDate = (date: DateTime) => date.setLocale('pt-BR').toFormat('dd/MM/yyyy');

const text = (config: Konva.TextConfig) =>
  new Konva.Text({ fontFamily: FONT, fontSize: 10, fill: COLOR_TEXT, ...config });

const chunkItems = (items: MonthlyInvoiceItem[]) => {
  const chunks = [items.slice(0, ROWS_ON_FIRST_PAGE)];

  for (let start = ROWS_ON_FIRST_PAGE; start < items.length; start += ROWS_ON_OTHER_PAGES) {
    chunks.push(items.slice(start, start + ROWS_ON_OTHER_PAGES));
  }

  return chunks;
};

const renderHeader = (layer: Konva.Layer, statement: BillingStatement) => {
  const issuedAt = DateTime.fromJSDate(statement.issuedAt).setZone('America/Sao_Paulo');
  const dueDate = DateTime.fromISO(statement.dueDate);

  layer.add(
    text({ x: MARGIN, y: MARGIN, text: 'CapivaSign', fontSize: 22, fontStyle: 'bold', fill: COLOR_BRAND }),
    text({ x: MARGIN, y: MARGIN + 30, text: 'Demonstrativo de cobrança', fontSize: 13, fontStyle: '600' }),
    text({
      x: MARGIN,
      y: MARGIN,
      width: CONTENT_WIDTH,
      align: 'right',
      lineHeight: 1.6,
      fill: COLOR_MUTED,
      text: [
        `Competência: ${formatPeriod(statement.period)}`,
        `Emissão: ${formatDate(issuedAt)}`,
        `Vencimento: ${formatDate(dueDate)}`,
      ].join('\n'),
    }),
  );
};

const renderPayer = (layer: Konva.Layer, statement: BillingStatement) => {
  const top = MARGIN + 70;

  layer.add(
    new Konva.Rect({ x: MARGIN, y: top, width: CONTENT_WIDTH, height: 100, fill: COLOR_PANEL, cornerRadius: 6 }),
    text({ x: MARGIN + 16, y: top + 14, text: 'Pagador', fontStyle: '600', fill: COLOR_MUTED }),
    text({
      x: MARGIN + 16,
      y: top + 32,
      width: CONTENT_WIDTH - 32,
      lineHeight: 1.6,
      text: [
        statement.payer.name,
        `CPF/CNPJ: ${formatCpfCnpj(statement.payer.document)}`,
        `E-mail: ${statement.payer.email}`,
        `Organização: ${statement.organisationName}`,
      ].join('\n'),
    }),
  );
};

const renderRow = (layer: Konva.Layer, y: number, cells: string[], style: Konva.TextConfig = {}) => {
  let x = MARGIN;

  COLUMNS.forEach((column, index) => {
    layer.add(
      text({
        x: x + 6,
        y: y + 6,
        width: column.width - 12,
        align: column.align,
        text: cells[index],
        wrap: 'none',
        ellipsis: true,
        ...style,
      }),
    );

    x += column.width;
  });

  layer.add(
    new Konva.Line({ points: [MARGIN, y + ROW_HEIGHT, MARGIN + CONTENT_WIDTH, y + ROW_HEIGHT], stroke: COLOR_BORDER }),
  );
};

const renderTable = (layer: Konva.Layer, top: number, items: MonthlyInvoiceItem[]) => {
  renderRow(
    layer,
    top,
    COLUMNS.map((column) => column.label),
    { fontStyle: '600', fill: COLOR_MUTED },
  );

  items.forEach((item, index) => {
    renderRow(
      layer,
      top + ROW_HEIGHT * (index + 1),
      COLUMNS.map((column) => CELL_VALUE[column.key](item)),
    );
  });

  return top + ROW_HEIGHT * (items.length + 1);
};

const renderTotal = (layer: Konva.Layer, top: number, statement: BillingStatement) => {
  const totalCents = statement.items.reduce((sum, item) => sum + item.amountCents, 0);

  layer.add(
    text({ x: MARGIN, y: top + 16, text: 'Total a pagar', fontSize: 13, fontStyle: 'bold' }),
    text({
      x: MARGIN,
      y: top + 16,
      width: CONTENT_WIDTH - 6,
      align: 'right',
      text: formatBrl(totalCents),
      fontSize: 13,
      fontStyle: 'bold',
    }),
    text({
      x: MARGIN,
      y: top + 48,
      width: CONTENT_WIDTH,
      lineHeight: 1.5,
      fill: COLOR_MUTED,
      text: `Pague por Pix, boleto ou cartão na página da fatura:\n${statement.invoiceUrl}`,
    }),
  );
};

const renderFooter = (layer: Konva.Layer, pageNumber: number, pageCount: number) => {
  layer.add(
    text({
      x: MARGIN,
      y: PAGE_HEIGHT - MARGIN + 12,
      width: CONTENT_WIDTH,
      align: 'right',
      fontSize: 8,
      fill: COLOR_MUTED,
      text: `Página ${pageNumber} de ${pageCount}`,
    }),
  );
};

const exportLayer = async (layer: Konva.Layer) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const canvas = layer.canvas._canvas as unknown as Canvas;

  return new Uint8Array(await canvas.toBuffer('pdf'));
};

/**
 * Itemised statement attached to the monthly Asaas charge, so the payer sees
 * each line (plan fee and every usage category) and not just the total.
 */
export const renderBillingStatementPdf = async (statement: BillingStatement) => {
  ensureFontLibrary();

  const stage = new Konva.Stage({ width: PAGE_WIDTH, height: PAGE_HEIGHT });
  const chunks = chunkItems(statement.items);
  const pages: Uint8Array[] = [];

  for (const [index, items] of chunks.entries()) {
    stage.destroyChildren();

    const layer = new Konva.Layer();
    const isFirstPage = index === 0;

    layer.add(new Konva.Rect({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, fill: '#ffffff' }));

    if (isFirstPage) {
      renderHeader(layer, statement);
      renderPayer(layer, statement);
    }

    const tableBottom = renderTable(layer, isFirstPage ? FIRST_PAGE_TABLE_TOP : OTHER_PAGE_TABLE_TOP, items);

    if (index === chunks.length - 1) {
      renderTotal(layer, tableBottom, statement);
    }

    renderFooter(layer, index + 1, chunks.length);

    stage.add(layer);
    pages.push(await exportLayer(layer));
  }

  stage.destroy();

  const merged = await PDF.merge(pages);

  return await merged.save();
};
