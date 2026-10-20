import { BillableEventType } from '@prisma/client';
import { DateTime } from 'luxon';

export type MonthlyInvoiceItem = {
  description: string;
  quantity: number;
  unitPriceCents: number;
  amountCents: number;
};

/** Usage of one category at one unit price, already net of the free allowance. */
export type MonthlyUsageLine = {
  type: BillableEventType;
  unitPriceCents: number;
  amountCents: number;
};

const INVOICE_DUE_IN_DAYS = 5;
const ASAAS_DESCRIPTION_LIMIT = 500;
const BILLING_TIME_ZONE = 'America/Sao_Paulo';
const DESCRIPTION_FOOTER = 'Detalhes no demonstrativo anexo.';

const BILLABLE_EVENT_LABEL: Record<BillableEventType, string> = {
  [BillableEventType.CREATE_DOCUMENT]: 'Documentos criados',
  [BillableEventType.RECOVER_FILE]: 'Downloads de arquivo',
  [BillableEventType.WHATSAPP_MESSAGE]: 'Mensagens de WhatsApp',
  [BillableEventType.WEBHOOK_DELIVERY]: 'Entregas de webhook',
  [BillableEventType.EMAIL_MESSAGE]: 'Mensagens de e-mail',
  [BillableEventType.EMBED_SESSION]: 'Sessões de embed',
};

const CATEGORY_ORDER = Object.values(BillableEventType);

const brlFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// Intl puts a no-break space after "R$"; a plain one keeps PDFs and the Asaas
// description predictable.
export const formatBrl = (cents: number) => brlFormatter.format(cents / 100).replace(/\s/g, ' ');

const quantityFormatter = new Intl.NumberFormat('pt-BR');

export const formatQuantity = (quantity: number) => quantityFormatter.format(quantity);

export const formatPeriod = (period: string) => period.split('-').reverse().join('/');

const isBilled = (line: MonthlyUsageLine) => line.amountCents > 0 && line.unitPriceCents > 0;

const compareUsageLines = (a: MonthlyUsageLine, b: MonthlyUsageLine) =>
  CATEGORY_ORDER.indexOf(a.type) - CATEGORY_ORDER.indexOf(b.type) || b.unitPriceCents - a.unitPriceCents;

const toUsageItem = (line: MonthlyUsageLine): MonthlyInvoiceItem => ({
  description: BILLABLE_EVENT_LABEL[line.type],
  quantity: Math.round(line.amountCents / line.unitPriceCents),
  unitPriceCents: line.unitPriceCents,
  amountCents: line.amountCents,
});

const buildPlanItems = (planName: string, monthlyPriceCents: number): MonthlyInvoiceItem[] =>
  monthlyPriceCents > 0
    ? [
        {
          description: `Plano ${planName}`,
          quantity: 1,
          unitPriceCents: monthlyPriceCents,
          amountCents: monthlyPriceCents,
        },
      ]
    : [];

export const buildMonthlyInvoiceItems = ({
  planName,
  monthlyPriceCents,
  usage,
}: {
  planName: string;
  monthlyPriceCents: number;
  usage: MonthlyUsageLine[];
}): MonthlyInvoiceItem[] => [
  ...buildPlanItems(planName, monthlyPriceCents),
  ...usage.filter(isBilled).sort(compareUsageLines).map(toUsageItem),
];

const formatItem = (item: MonthlyInvoiceItem) =>
  item.quantity === 1
    ? `${item.description}: ${formatBrl(item.amountCents)}. `
    : `${item.description}: ${formatQuantity(item.quantity)} x ${formatBrl(item.unitPriceCents)} = ${formatBrl(item.amountCents)}. `;

/**
 * Short itemisation for the Asaas `description` (shown on the invoice and the
 * boleto). Lines that do not fit in 500 characters are summarised as "E mais N
 * itens"; the attached statement always has all of them.
 */
export const buildInvoiceDescription = ({ period, items }: { period: string; items: MonthlyInvoiceItem[] }) => {
  const header = `CapivaSign ${formatPeriod(period)}. `;
  const lines = items.map(formatItem);

  const compose = (keptCount: number) => {
    const omittedCount = lines.length - keptCount;
    const omitted = omittedCount > 0 ? `E mais ${omittedCount} itens. ` : '';

    return header + lines.slice(0, keptCount).join('') + omitted + DESCRIPTION_FOOTER;
  };

  // Try keeping every line first, then one fewer each time.
  const candidateCounts = lines.map((_, index) => lines.length - index);
  const fittingCount = candidateCounts.find((count) => compose(count).length <= ASAAS_DESCRIPTION_LIMIT) ?? 0;

  return compose(fittingCount);
};

/** Due date (YYYY-MM-DD) counted from the issue day in Brasília. */
export const getInvoiceDueDate = (issuedAt: Date) =>
  DateTime.fromJSDate(issuedAt).setZone(BILLING_TIME_ZONE).plus({ days: INVOICE_DUE_IN_DAYS }).toISODate() ?? '';
