import { trpc } from '@documenso/trpc/react';
import type { TFindWhatsappTransportsResponse } from '@documenso/trpc/server/admin-router/whatsapp-transport/find-whatsapp-transports.types';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
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

import {
  WhatsappTransportForm,
  type WhatsappTransportFormValues,
  whatsappTransportFormToConfig,
} from '../forms/whatsapp-transport-form';

export type WhatsappTransportUpdateDialogProps = {
  transport: TFindWhatsappTransportsResponse['data'][number];
  trigger: React.ReactNode;
};

export const WhatsappTransportUpdateDialog = ({ transport, trigger }: WhatsappTransportUpdateDialogProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);

  const { mutateAsync: updateTransport, isPending } = trpc.admin.whatsappTransport.update.useMutation();

  const onFormSubmit = async (values: WhatsappTransportFormValues) => {
    try {
      await updateTransport({
        id: transport.id,
        data: {
          name: values.name,
          fromName: values.fromName,
          config: whatsappTransportFormToConfig(values),
        },
      });

      toast({
        title: t`Transport updated.`,
      });

      setOpen(false);
    } catch {
      toast({
        title: t`Failed to save transport.`,
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !isPending && setOpen(value)}>
      <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>
        {trigger}
      </DialogTrigger>

      <DialogContent className="scrollbar-hidden max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            <Trans>Edit WhatsApp Transport</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>Modify the details of the WhatsApp transport.</Trans>
          </DialogDescription>
        </DialogHeader>

        <WhatsappTransportForm
          isEdit
          defaultValues={{
            // Pre-fill the non-secret connection settings; secrets stay blank
            // and are preserved on save unless re-entered.
            ...(transport.config ?? {}),
            name: transport.name,
            fromName: transport.fromName,
            type: transport.type,
          }}
          onFormSubmit={onFormSubmit}
          formSubmitTrigger={
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                <Trans>Cancel</Trans>
              </Button>

              <Button type="submit" loading={isPending}>
                <Trans>Save changes</Trans>
              </Button>
            </DialogFooter>
          }
        />
      </DialogContent>
    </Dialog>
  );
};
