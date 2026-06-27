import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@documenso/ui/primitives/select';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const ZWhatsappTransportFormSchema = z.object({
  name: z.string().min(1),
  fromName: z.string().min(1),
  type: z.enum(['ZAPI']),
  instanceId: z.string().optional(),
  token: z.string().optional(),
  clientToken: z.string().optional(),
  baseUrl: z.string().optional(),
});

export type WhatsappTransportFormValues = z.infer<typeof ZWhatsappTransportFormSchema>;

type WhatsappTransportFormProps = {
  defaultValues?: Partial<WhatsappTransportFormValues>;
  isEdit?: boolean;
  onFormSubmit: (values: WhatsappTransportFormValues) => Promise<void>;
  formSubmitTrigger?: React.ReactNode;
};

export const WhatsappTransportForm = ({
  defaultValues,
  isEdit = false,
  onFormSubmit,
  formSubmitTrigger,
}: WhatsappTransportFormProps) => {
  const { t } = useLingui();

  const form = useForm<WhatsappTransportFormValues>({
    resolver: zodResolver(ZWhatsappTransportFormSchema),
    defaultValues: {
      name: '',
      fromName: '',
      type: 'ZAPI',
      ...defaultValues,
    },
  });

  const type = form.watch('type');
  const secretPlaceholder = isEdit ? t`Leave blank to keep current` : undefined;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onFormSubmit)}>
        <fieldset disabled={form.formState.isSubmitting} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <Trans>Name</Trans>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder={t`e.g. Z-API (production)`} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="fromName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <Trans>From name</Trans>
                  </FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Provider</Trans>
                </FormLabel>
                <Select value={field.value} onValueChange={field.onChange} disabled={isEdit}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="ZAPI">Z-API</SelectItem>
                  </SelectContent>
                </Select>
                {isEdit && (
                  <FormDescription>
                    <Trans>Provider cannot be changed after creation.</Trans>
                  </FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          {type === 'ZAPI' && (
            <>
              <FormField
                control={form.control}
                name="instanceId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>Instance ID</Trans>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="token"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>Token</Trans>
                    </FormLabel>
                    <FormControl>
                      <Input type="password" placeholder={secretPlaceholder} {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clientToken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>Client token (optional)</Trans>
                    </FormLabel>
                    <FormControl>
                      <Input type="password" placeholder={secretPlaceholder} {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormDescription>
                      <Trans>Account-level security token sent as the Client-Token header.</Trans>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="baseUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>Base URL (optional)</Trans>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="https://api.z-api.io" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          {formSubmitTrigger}
        </fieldset>
      </form>
    </Form>
  );
};

/**
 * Maps flat form values to the tRPC `config` discriminated union.
 */
export const whatsappTransportFormToConfig = (values: WhatsappTransportFormValues) => {
  switch (values.type) {
    case 'ZAPI':
      return {
        type: 'ZAPI' as const,
        instanceId: values.instanceId ?? '',
        token: values.token || '',
        clientToken: values.clientToken || undefined,
        baseUrl: values.baseUrl || undefined,
      };
  }
};
