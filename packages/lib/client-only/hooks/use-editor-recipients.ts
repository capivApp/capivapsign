import { IS_INSTANCE_CSC_MODE } from '@documenso/lib/constants/app';
import { ZRecipientActionAuthTypesSchema, ZRecipientAuthOptionsSchema } from '@documenso/lib/types/document-auth';
import type { TEditorEnvelope } from '@documenso/lib/types/envelope-editor';
import { ZRecipientEmailSchema } from '@documenso/lib/types/recipient';
import { zodResolver } from '@hookform/resolvers/zod';
import { DocumentSigningOrder, RecipientRole } from '@prisma/client';
import { useId } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { prop, sortBy } from 'remeda';
import { z } from 'zod';

const LocalRecipientSchema = z.object({
  formId: z.string().min(1),
  id: z.number().optional(),
  email: ZRecipientEmailSchema,
  name: z.string(),
  role: z.nativeEnum(RecipientRole),
  signingOrder: z.number().optional(),
  actionAuth: z.array(ZRecipientActionAuthTypesSchema).optional().default([]),
  // Delivery channel for the signing request. WhatsApp requires a phone.
  // String enum (not the Prisma enum object) to stay browser-safe.
  deliveryChannel: z.enum(['EMAIL', 'WHATSAPP']).default('EMAIL'),
  phone: z.string().optional().default(''),
});

type TLocalRecipient = z.infer<typeof LocalRecipientSchema>;

/**
 * Backstop validation that mirrors the CSC-mode UI overrides in
 * `EnvelopeEditorProvider`. If anything bypasses the disabled controls (URL
 * tampering, legacy form state, embedded host) the form refuses to submit
 * rather than persisting values the TSP flow can't honour.
 */
export const ZEditorRecipientsFormSchema = z
  .object({
    signers: z.array(LocalRecipientSchema),
    signingOrder: z.nativeEnum(DocumentSigningOrder),
    allowDictateNextSigner: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (!IS_INSTANCE_CSC_MODE()) {
      return;
    }

    if (data.signingOrder !== DocumentSigningOrder.SEQUENTIAL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CSC envelopes must use SEQUENTIAL signing order.',
        path: ['signingOrder'],
      });
    }

    if (data.allowDictateNextSigner) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CSC envelopes do not support next-signer dictation.',
        path: ['allowDictateNextSigner'],
      });
    }

    data.signers.forEach((signer, index) => {
      if (signer.role === RecipientRole.ASSISTANT) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'CSC envelopes do not support the assistant role.',
          path: ['signers', index, 'role'],
        });
      }
    });
  })
  .superRefine((data, ctx) => {
    // Channel-conditional contact: WhatsApp recipients need a phone (email is
    // optional); email recipients need an email. Empty rows are ignored — they
    // are dropped before submit.
    data.signers.forEach((signer, index) => {
      const isEmptyRow = !signer.name && !signer.email && !signer.phone;

      if (isEmptyRow) {
        return;
      }

      if (signer.deliveryChannel === 'WHATSAPP') {
        if (!signer.phone || signer.phone.replace(/\D/g, '').length < 8) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Informe um telefone válido para o canal WhatsApp.',
            path: ['signers', index, 'phone'],
          });
        }
      } else if (!signer.email) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Informe um e-mail.',
          path: ['signers', index, 'email'],
        });
      }
    });
  });

export type TEditorRecipientsFormSchema = z.infer<typeof ZEditorRecipientsFormSchema>;

type EditorRecipientsProps = {
  envelope: TEditorEnvelope;
};

type ResetFormOptions = {
  recipients?: TEditorEnvelope['recipients'];
  documentMeta?: TEditorEnvelope['documentMeta'];
};

type UseEditorRecipientsResponse = {
  form: UseFormReturn<TEditorRecipientsFormSchema>;
  resetForm: (options?: ResetFormOptions) => void;
};

export const useEditorRecipients = ({ envelope }: EditorRecipientsProps): UseEditorRecipientsResponse => {
  const initialId = useId();

  const generateDefaultValues = (options?: ResetFormOptions) => {
    const { recipients, documentMeta } = options ?? {};

    const formRecipients = (recipients || envelope.recipients).map((recipient, index) => ({
      id: recipient.id,
      formId: String(recipient.id),
      name: recipient.name,
      email: recipient.email,
      role: recipient.role,
      signingOrder: recipient.signingOrder ?? index + 1,
      actionAuth: ZRecipientAuthOptionsSchema.parse(recipient.authOptions)?.actionAuth ?? undefined,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      deliveryChannel: (recipient.deliveryChannel ?? 'EMAIL') as 'EMAIL' | 'WHATSAPP',
      phone: recipient.phone ?? '',
    }));

    const signers: TLocalRecipient[] =
      formRecipients.length > 0
        ? sortBy(formRecipients, [prop('signingOrder'), 'asc'], [prop('id'), 'asc'])
        : [
            {
              formId: initialId,
              name: '',
              email: '',
              role: RecipientRole.SIGNER,
              signingOrder: 1,
              actionAuth: [],
              deliveryChannel: 'EMAIL',
              phone: '',
            },
          ];

    return {
      signers,
      signingOrder: documentMeta?.signingOrder ?? envelope.documentMeta.signingOrder,
      allowDictateNextSigner: documentMeta?.allowDictateNextSigner ?? envelope.documentMeta.allowDictateNextSigner,
    };
  };

  const form = useForm<TEditorRecipientsFormSchema>({
    defaultValues: generateDefaultValues(),
    resolver: zodResolver(ZEditorRecipientsFormSchema),
    mode: 'onChange', // Used for autosave purposes, maybe can try onBlur instead?
  });

  const resetForm = (options?: ResetFormOptions) => {
    form.reset(generateDefaultValues(options));
  };

  return {
    form,
    resetForm,
  };
};
