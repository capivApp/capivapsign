import { AppError } from '@documenso/lib/errors/app-error';
import { formatCpfCnpj } from '@documenso/lib/utils/cpf-cnpj';
import { trpc } from '@documenso/trpc/react';
import {
  type TBillingProfileSchema,
  ZBillingProfileSchema,
} from '@documenso/trpc/server/enterprise-router/update-billing-profile.types';
import { Button } from '@documenso/ui/primitives/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import { useForm } from 'react-hook-form';

export type OrganisationBillingProfileFormProps = {
  organisationId: string;
  defaultValues: TBillingProfileSchema;
  canManageBilling: boolean;
};

export const OrganisationBillingProfileForm = ({
  organisationId,
  defaultValues,
  canManageBilling,
}: OrganisationBillingProfileFormProps) => {
  const { t } = useLingui();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const form = useForm<TBillingProfileSchema>({
    resolver: zodResolver(ZBillingProfileSchema),
    defaultValues: { ...defaultValues, billingDocument: formatCpfCnpj(defaultValues.billingDocument) },
  });

  const { mutateAsync: updateBillingProfile } = trpc.enterprise.billing.profile.update.useMutation();

  const onSubmit = async (values: TBillingProfileSchema) => {
    try {
      await updateBillingProfile({ organisationId, ...values });

      await utils.enterprise.billing.get.invalidate({ organisationId });

      toast({ title: t`Billing details saved.` });
    } catch (err) {
      const error = AppError.parseError(err);

      // Asaas refusals (usually the CPF/CNPJ) come back as a user message.
      form.setError('billingDocument', {
        message: error.userMessage ?? t`We could not save the billing details. Please try again.`,
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <fieldset className="grid gap-4 md:grid-cols-3" disabled={!canManageBilling || form.formState.isSubmitting}>
          <FormField
            control={form.control}
            name="billingName"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>
                  <Trans>Name or company name</Trans>
                </FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="billingDocument"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>
                  <Trans>CPF or CNPJ</Trans>
                </FormLabel>
                <FormControl>
                  <Input {...field} inputMode="text" autoComplete="off" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="billingEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>
                  <Trans>Billing email</Trans>
                </FormLabel>
                <FormControl>
                  <Input type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {canManageBilling && (
            <div className="md:col-span-3">
              <Button type="submit" loading={form.formState.isSubmitting}>
                <Trans>Save billing details</Trans>
              </Button>
            </div>
          )}
        </fieldset>
      </form>
    </Form>
  );
};
