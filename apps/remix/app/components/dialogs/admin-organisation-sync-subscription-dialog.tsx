import { AppError } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { useNavigate } from 'react-router';

export type AdminOrganisationSyncSubscriptionDialogProps = {
  organisationId: string;
  trigger?: React.ReactNode;
};

/**
 * Re-reads the organisation's open Asaas charges, for when a webhook was missed.
 */
export const AdminOrganisationSyncSubscriptionDialog = ({
  organisationId,
  trigger,
}: AdminOrganisationSyncSubscriptionDialogProps) => {
  const [open, setOpen] = useState(false);

  const { t } = useLingui();
  const { toast } = useToast();
  const navigate = useNavigate();

  const { mutateAsync: syncSubscription, isPending } = trpc.admin.organisation.subscription.sync.useMutation();

  const onConfirm = async () => {
    try {
      await syncSubscription({ organisationId });

      toast({
        title: t`Billing synced`,
        description: t`Open bills were checked against Asaas.`,
        duration: 5000,
      });

      await navigate(0);

      setOpen(false);
    } catch (err) {
      const error = AppError.parseError(err);

      console.error(error);

      toast({
        title: t`Failed to sync billing`,
        description: error.message,
        variant: 'destructive',
        duration: 10000,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !isPending && setOpen(value)}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline">
            <Trans>Sync with Asaas</Trans>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Sync with Asaas</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>
              Checks every open bill against Asaas and updates whether the organisation is held to free plan limits.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary" disabled={isPending}>
              <Trans>Cancel</Trans>
            </Button>
          </DialogClose>

          <Button loading={isPending} onClick={() => void onConfirm()}>
            <Trans>Sync</Trans>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
