import { formatBrl, formatPeriod, formatQuantity } from '@documenso/lib/universal/billing-format';
import { trpc } from '@documenso/trpc/react';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@documenso/ui/primitives/table';
import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { UsageInvoiceStatus } from '@prisma/client';
import { useMemo } from 'react';
import { Link } from 'react-router';

export type OrganisationBillingInvoicesTableProps = {
  organisationId: string;
};

const INVOICE_STATUS_BADGE: Record<
  UsageInvoiceStatus,
  { label: MessageDescriptor; variant: 'default' | 'warning' | 'destructive' | 'neutral' }
> = {
  [UsageInvoiceStatus.PENDING]: { label: msg({ message: `Open`, context: `Bill status` }), variant: 'warning' },
  [UsageInvoiceStatus.PAID]: { label: msg({ message: `Paid`, context: `Bill status` }), variant: 'default' },
  [UsageInvoiceStatus.OVERDUE]: { label: msg({ message: `Overdue`, context: `Bill status` }), variant: 'destructive' },
  [UsageInvoiceStatus.CANCELLED]: { label: msg({ message: `Cancelled`, context: `Bill status` }), variant: 'neutral' },
  [UsageInvoiceStatus.WAIVED]: { label: msg({ message: `Not charged`, context: `Bill status` }), variant: 'neutral' },
};

const PAYABLE_STATUSES: UsageInvoiceStatus[] = [UsageInvoiceStatus.PENDING, UsageInvoiceStatus.OVERDUE];

export const OrganisationBillingInvoicesTable = ({ organisationId }: OrganisationBillingInvoicesTableProps) => {
  const { _, i18n } = useLingui();

  const { data, isLoading, isLoadingError } = trpc.enterprise.billing.invoices.get.useQuery(
    { organisationId },
    { placeholderData: (previousData) => previousData },
  );

  const invoices = data ?? [];

  const columns = useMemo(() => {
    return [
      {
        header: _(msg`Month`),
        accessorKey: 'period',
        cell: ({ row }) => (
          <span className="font-semibold text-foreground/80">{formatPeriod(row.original.period)}</span>
        ),
      },
      {
        header: _(msg`Due date`),
        accessorKey: 'dueDate',
        cell: ({ row }) => (row.original.dueDate ? i18n.date(row.original.dueDate, { timeZone: 'UTC' }) : '-'),
      },
      {
        header: _(msg`Total`),
        accessorKey: 'totalCents',
        cell: ({ row }) => formatBrl(row.original.totalCents),
      },
      {
        header: _(msg`Status`),
        accessorKey: 'status',
        cell: ({ row }) => {
          const badge = INVOICE_STATUS_BADGE[row.original.status];

          return <Badge variant={badge.variant}>{_(badge.label)}</Badge>;
        },
      },
      {
        id: 'actions',
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <InvoiceItemsDialog invoice={row.original} />

            {row.original.invoiceUrl && (
              <Button variant={PAYABLE_STATUSES.includes(row.original.status) ? 'default' : 'outline'} asChild>
                <Link to={row.original.invoiceUrl} target="_blank">
                  {PAYABLE_STATUSES.includes(row.original.status) ? <Trans>Pay</Trans> : <Trans>View bill</Trans>}
                </Link>
              </Button>
            )}
          </div>
        ),
      },
    ] satisfies DataTableColumnDef<(typeof invoices)[number]>[];
  }, []);

  if (!isLoading && invoices.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        <Trans>No bills yet. Bills are issued on the 1st of each month.</Trans>
      </p>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={invoices}
      perPage={100}
      currentPage={1}
      totalPages={1}
      error={{ enable: isLoadingError }}
      skeleton={{
        enable: isLoading,
        rows: 3,
        component: (
          <>
            <TableCell>
              <Skeleton className="h-4 w-16 rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-20 rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-20 rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-12 rounded-full" />
            </TableCell>
            <TableCell>
              <div className="flex flex-row justify-end gap-2">
                <Skeleton className="h-10 w-20 rounded" />
              </div>
            </TableCell>
          </>
        ),
      }}
    />
  );
};

type InvoiceItemsDialogProps = {
  invoice: {
    period: string;
    totalCents: number;
    items: { id: string; description: string; quantity: number; unitPriceCents: number; amountCents: number }[];
  };
};

const InvoiceItemsDialog = ({ invoice }: InvoiceItemsDialogProps) => {
  const period = formatPeriod(invoice.period);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Trans>Details</Trans>
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Bill for {period}</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>Plan fee, usage and discount for this month.</Trans>
          </DialogDescription>
        </DialogHeader>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Trans>Description</Trans>
              </TableHead>
              <TableHead className="text-right">
                <Trans>Qty.</Trans>
              </TableHead>
              <TableHead className="text-right">
                <Trans>Unit price</Trans>
              </TableHead>
              <TableHead className="text-right">
                <Trans>Total</Trans>
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {invoice.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.description}</TableCell>
                <TableCell className="text-right">{formatQuantity(item.quantity)}</TableCell>
                <TableCell className="text-right">{formatBrl(item.unitPriceCents)}</TableCell>
                <TableCell className="text-right">{formatBrl(item.amountCents)}</TableCell>
              </TableRow>
            ))}

            <TableRow>
              <TableCell colSpan={3} className="font-semibold">
                <Trans>Total</Trans>
              </TableCell>
              <TableCell className="text-right font-semibold">{formatBrl(invoice.totalCents)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
};
