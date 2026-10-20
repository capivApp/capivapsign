import { prisma } from '@documenso/prisma';

import type { AsaasClient } from '../asaas/asaas-client';
import { getAsaasClient } from '../asaas/get-asaas-client';
import type { AsaasCustomerInput } from '../asaas/types';

export type SaveOrganisationBillingProfileOptions = {
  organisationId: string;
  billingName: string;
  /** Already normalized (see ZCpfCnpjSchema). */
  billingDocument: string;
  billingEmail: string;
  asaas?: AsaasClient;
};

/**
 * Stores who pays for the organisation and mirrors it as the organisation's
 * Asaas customer, creating the customer on first save. Asaas is called first so
 * a document it refuses is never stored.
 */
export const saveOrganisationBillingProfile = async ({
  organisationId,
  billingName,
  billingDocument,
  billingEmail,
  asaas = getAsaasClient(),
}: SaveOrganisationBillingProfileOptions) => {
  const { customerId } = await prisma.organisation.findUniqueOrThrow({
    where: { id: organisationId },
    select: { customerId: true },
  });

  const customerInput: AsaasCustomerInput = {
    name: billingName,
    cpfCnpj: billingDocument,
    email: billingEmail,
    externalReference: organisationId,
  };

  const customer = customerId
    ? await asaas.updateCustomer(customerId, customerInput)
    : await asaas.createCustomer(customerInput);

  await prisma.organisation.update({
    where: { id: organisationId },
    data: {
      billingName,
      billingDocument,
      billingEmail,
      customerId: customer.id,
    },
  });
};
