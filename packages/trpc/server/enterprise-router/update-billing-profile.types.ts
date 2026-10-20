import { ZCpfCnpjSchema } from '@documenso/lib/utils/cpf-cnpj';
import { z } from 'zod';

export const ZBillingProfileSchema = z.object({
  billingName: z.string().trim().min(3, 'Informe o nome ou a razão social.'),
  billingDocument: ZCpfCnpjSchema,
  billingEmail: z.string().trim().email('Informe um e-mail válido.'),
});

export const ZUpdateBillingProfileRequestSchema = ZBillingProfileSchema.extend({
  organisationId: z.string().describe('The organisation that pays'),
});

export type TBillingProfileSchema = z.infer<typeof ZBillingProfileSchema>;
