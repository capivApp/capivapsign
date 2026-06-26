import {
  SITE_SETTINGS_SIGNING_TIMESTAMP_ID,
  type TSiteSettingsSigningTimestampSchema,
} from '@documenso/lib/server-only/site-settings/schemas/signing-timestamp';
import { trpc as trpcReact } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from '@documenso/ui/primitives/form/form';
import { Switch } from '@documenso/ui/primitives/switch';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useForm } from 'react-hook-form';
import { useRevalidator } from 'react-router';

type TSigningTimestampFormSchema = {
  enabled: boolean;
};

type AdminSigningTimestampSectionProps = {
  signingTimestamp: TSiteSettingsSigningTimestampSchema | undefined;
};

export const AdminSigningTimestampSection = ({ signingTimestamp }: AdminSigningTimestampSectionProps) => {
  const { toast } = useToast();
  const { _ } = useLingui();
  const { revalidate } = useRevalidator();

  const form = useForm<TSigningTimestampFormSchema>({
    defaultValues: {
      // Absent → on, mirroring the server default (`getIsSigningTimestampEnabled`).
      enabled: signingTimestamp?.enabled ?? true,
    },
  });

  const { mutateAsync: updateSiteSetting, isPending } = trpcReact.admin.updateSiteSetting.useMutation();

  const onSubmit = async ({ enabled }: TSigningTimestampFormSchema) => {
    try {
      await updateSiteSetting({
        id: SITE_SETTINGS_SIGNING_TIMESTAMP_ID,
        enabled,
        data: {},
      });

      toast({
        title: _(msg`Setting updated`),
        description: _(msg`The signing timestamp setting has been updated.`),
        duration: 5000,
      });

      await revalidate();
    } catch (err) {
      toast({
        title: _(msg`An unknown error occurred`),
        variant: 'destructive',
        description: _(msg`We couldn't update the signing timestamp setting. Please try again later.`),
      });
    }
  };

  return (
    <div>
      <h2 className="font-semibold">
        <Trans>Signing Timestamp</Trans>
      </h2>
      <p className="mt-2 text-muted-foreground text-sm">
        <Trans>
          When enabled, signatures embed a trusted RFC&nbsp;3161 timestamp (PAdES B-T per signer plus the archival B-LTA
          document timestamp). Disable it to sign with the certificate only (B-B) — useful when you don't have a
          timestamp authority. Affects documents signed after the change.
        </Trans>
      </p>

      <Form {...form}>
        <form className="mt-4 flex flex-col rounded-md" onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            control={form.control}
            name="enabled"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Embed timestamp</Trans>
                </FormLabel>

                <FormControl>
                  <div>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </div>
                </FormControl>

                <FormDescription>
                  <Trans>Turn off if no timestamp authority is configured.</Trans>
                </FormDescription>
              </FormItem>
            )}
          />

          <Button type="submit" loading={isPending} className="mt-4 justify-end self-end">
            <Trans>Update Setting</Trans>
          </Button>
        </form>
      </Form>
    </div>
  );
};
