import { prisma } from '@documenso/prisma';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AsaasClient } from '../asaas/asaas-client';
import { saveOrganisationBillingProfile } from './save-organisation-billing-profile';

vi.mock('@documenso/prisma', () => ({
  prisma: {
    organisation: {
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const createFakeAsaas = () => ({
  createCustomer: vi.fn(async () => ({ id: 'cus_new', name: '', cpfCnpj: '' })),
  updateCustomer: vi.fn(async () => ({ id: 'cus_existing', name: '', cpfCnpj: '' })),
});

const PROFILE = {
  organisationId: 'org_1',
  billingName: 'Capivapp Ltda',
  billingDocument: '11222333000181',
  billingEmail: 'financeiro@capivapp.com.br',
};

const EXPECTED_CUSTOMER = {
  name: 'Capivapp Ltda',
  cpfCnpj: '11222333000181',
  email: 'financeiro@capivapp.com.br',
  externalReference: 'org_1',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('saveOrganisationBillingProfile', () => {
  it('creates the Asaas customer the first time and stores its id', async () => {
    vi.mocked(prisma.organisation.findUniqueOrThrow).mockResolvedValue({ customerId: null } as never);
    const asaas = createFakeAsaas();

    await saveOrganisationBillingProfile({ ...PROFILE, asaas: asaas as unknown as AsaasClient });

    expect(asaas.createCustomer).toHaveBeenCalledWith(EXPECTED_CUSTOMER);
    expect(asaas.updateCustomer).not.toHaveBeenCalled();
    expect(prisma.organisation.update).toHaveBeenCalledWith({
      where: { id: 'org_1' },
      data: {
        billingName: 'Capivapp Ltda',
        billingDocument: '11222333000181',
        billingEmail: 'financeiro@capivapp.com.br',
        customerId: 'cus_new',
      },
    });
  });

  it('updates the existing Asaas customer', async () => {
    vi.mocked(prisma.organisation.findUniqueOrThrow).mockResolvedValue({ customerId: 'cus_existing' } as never);
    const asaas = createFakeAsaas();

    await saveOrganisationBillingProfile({ ...PROFILE, asaas: asaas as unknown as AsaasClient });

    expect(asaas.updateCustomer).toHaveBeenCalledWith('cus_existing', EXPECTED_CUSTOMER);
    expect(asaas.createCustomer).not.toHaveBeenCalled();
    expect(prisma.organisation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ customerId: 'cus_existing' }) }),
    );
  });

  it('does not save anything when Asaas refuses the customer', async () => {
    vi.mocked(prisma.organisation.findUniqueOrThrow).mockResolvedValue({ customerId: null } as never);
    const asaas = createFakeAsaas();
    asaas.createCustomer.mockRejectedValue(new Error('O CPF/CNPJ informado é inválido.'));

    await expect(
      saveOrganisationBillingProfile({ ...PROFILE, asaas: asaas as unknown as AsaasClient }),
    ).rejects.toThrow('O CPF/CNPJ informado é inválido.');

    expect(prisma.organisation.update).not.toHaveBeenCalled();
  });
});
