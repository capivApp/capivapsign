import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { trpc } from '@documenso/trpc/react';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { SpinnerBox } from '@documenso/ui/primitives/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@documenso/ui/primitives/table';
import type { BillableEventType } from '@prisma/client';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { DateTime } from 'luxon';
import { useMemo, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { SettingsHeader } from '~/components/general/settings-header';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags(msg`Usage & Billing`);
}

// Stable order + colour + label per billable category.
// String literals (not the Prisma enum object) so this works in the browser
// bundle — `@prisma/client` enum values are not available client-side.
const CATEGORY_META: { type: BillableEventType; label: string; color: string }[] = [
  { type: 'CREATE_DOCUMENT', label: 'Create document', color: '#94a3b8' },
  { type: 'RECOVER_FILE', label: 'Recover file', color: '#64748b' },
  { type: 'EMAIL_MESSAGE', label: 'Email', color: '#3b82f6' },
  { type: 'WHATSAPP_MESSAGE', label: 'WhatsApp', color: '#22c55e' },
  { type: 'WEBHOOK_DELIVERY', label: 'Webhook', color: '#a855f7' },
  { type: 'EMBED_SESSION', label: 'Embed', color: '#f59e0b' },
];

const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function OrganisationUsagePage() {
  const { t } = useLingui();
  const organisation = useCurrentOrganisation();

  const [from, setFrom] = useState(() => DateTime.now().startOf('month').toISODate() ?? '');
  const [to, setTo] = useState(() => DateTime.now().toISODate() ?? '');

  const { data, isLoading } = trpc.organisation.usage.summary.useQuery({
    organisationId: organisation.id,
    from,
    to,
  });

  const chartData = useMemo(() => {
    return (data?.byDay ?? []).map((day) => {
      const row: Record<string, number | string> = { date: DateTime.fromISO(day.date).toFormat('dd/MM') };
      for (const category of CATEGORY_META) {
        row[category.type] = (day.byType[category.type] ?? 0) / 100;
      }
      return row;
    });
  }, [data?.byDay]);

  const labelFor = (type: BillableEventType) => CATEGORY_META.find((c) => c.type === type)?.label ?? type;

  return (
    <div className="max-w-4xl">
      <SettingsHeader
        title={t`Usage & Billing`}
        subtitle={t`Metered usage billed to this organisation. Only actions performed via the API are charged.`}
      />

      <div className="mb-6 flex items-end gap-4">
        <div>
          <Label className="text-xs">
            {t`From`}
          </Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">
            {t`To`}
          </Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {isLoading || !data ? (
        <SpinnerBox />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground text-xs">{t`Total cost`}</p>
              <p className="mt-1 text-2xl font-semibold">{brl(data.totalCents)}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground text-xs">{t`Documents created`}</p>
              <p className="mt-1 text-2xl font-semibold">{data.documentCount}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground text-xs">{t`Average cost per document`}</p>
              <p className="mt-1 text-2xl font-semibold">{brl(data.avgPerDocumentCents)}</p>
            </div>
          </div>

          <div className="mt-6 rounded-lg border p-4">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData}>
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(value) => `R$ ${value}`} />
                <Tooltip
                  formatter={(value: number, name) => [brl(Number(value) * 100), labelFor(name as BillableEventType)]}
                  cursor={{ fill: 'hsl(var(--primary) / 8%)' }}
                />
                {CATEGORY_META.map((category) => (
                  <Bar
                    key={category.type}
                    dataKey={category.type}
                    stackId="usage"
                    fill={category.color}
                    maxBarSize={48}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-6 rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t`Category`}</TableHead>
                  <TableHead className="text-right">{t`Consumption`}</TableHead>
                  <TableHead className="text-right">{t`Price (BRL)`}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {CATEGORY_META.map((category) => {
                  const row = data.byCategory.find((c) => c.type === category.type);
                  return (
                    <TableRow key={category.type}>
                      <TableCell>
                        <span className="inline-flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: category.color }} />
                          {category.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{row?.quantity ?? 0}</TableCell>
                      <TableCell className="text-right">{brl(row?.amountCents ?? 0)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
