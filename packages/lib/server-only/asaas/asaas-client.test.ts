import { describe, expect, it } from 'vitest';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { createAsaasClient } from './asaas-client';

type RecordedRequest = { url: string; init: RequestInit };

const createFakeFetch = (status: number, body: unknown) => {
  const requests: RecordedRequest[] = [];

  const fetch = async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), init: init ?? {} });

    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  };

  return { fetch, requests };
};

const getHeader = (request: RecordedRequest, name: string) => new Headers(request.init.headers).get(name);

describe('createAsaasClient', () => {
  it('sends JSON requests to the sandbox API with the access token', async () => {
    const { fetch, requests } = createFakeFetch(200, { id: 'cus_123', name: 'Capivapp Ltda' });

    const asaas = createAsaasClient({ apiKey: 'key_sandbox', environment: 'sandbox', fetch });

    const customer = await asaas.createCustomer({
      name: 'Capivapp Ltda',
      cpfCnpj: '12345678000195',
      email: 'financeiro@capivapp.com.br',
      externalReference: 'org_1',
    });

    expect(customer.id).toBe('cus_123');
    expect(requests[0].url).toBe('https://api-sandbox.asaas.com/v3/customers');
    expect(requests[0].init.method).toBe('POST');
    expect(getHeader(requests[0], 'access_token')).toBe('key_sandbox');
    expect(getHeader(requests[0], 'content-type')).toBe('application/json');
    expect(JSON.parse(String(requests[0].init.body))).toEqual({
      name: 'Capivapp Ltda',
      cpfCnpj: '12345678000195',
      email: 'financeiro@capivapp.com.br',
      externalReference: 'org_1',
    });
  });

  it('uses the production API in production', async () => {
    const { fetch, requests } = createFakeFetch(200, { id: 'pay_1', status: 'PENDING', invoiceUrl: 'https://x' });

    const asaas = createAsaasClient({ apiKey: 'key_prod', environment: 'production', fetch });

    await asaas.createPayment({
      customer: 'cus_123',
      billingType: 'UNDEFINED',
      value: 149.9,
      dueDate: '2026-11-06',
      description: 'Mensalidade',
      externalReference: 'usage_invoice_1',
    });

    expect(requests[0].url).toBe('https://api.asaas.com/v3/payments');
  });

  it('updates a customer with PUT on its id', async () => {
    const { fetch, requests } = createFakeFetch(200, { id: 'cus_123' });

    const asaas = createAsaasClient({ apiKey: 'key', environment: 'sandbox', fetch });

    await asaas.updateCustomer('cus_123', { name: 'Novo nome' });

    expect(requests[0].url).toBe('https://api-sandbox.asaas.com/v3/customers/cus_123');
    expect(requests[0].init.method).toBe('PUT');
  });

  it('turns an Asaas validation error into an AppError with the Asaas message', async () => {
    const { fetch } = createFakeFetch(400, {
      errors: [{ code: 'invalid_cpfCnpj', description: 'O CPF/CNPJ informado é inválido.' }],
    });

    const asaas = createAsaasClient({ apiKey: 'key', environment: 'sandbox', fetch });

    const error = await asaas.createCustomer({ name: 'X', cpfCnpj: '1' }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({
      code: AppErrorCode.INVALID_REQUEST,
      statusCode: 400,
      userMessage: 'O CPF/CNPJ informado é inválido.',
    });
  });

  it('reports other failures as unknown errors keeping the status', async () => {
    const { fetch } = createFakeFetch(401, {
      errors: [{ code: 'invalid_access_token', description: 'A chave de API fornecida é inválida' }],
    });

    const asaas = createAsaasClient({ apiKey: 'bad', environment: 'sandbox', fetch });

    const error = await asaas.getPayment('pay_1').catch((err: unknown) => err);

    expect(error).toMatchObject({ code: AppErrorCode.UNKNOWN_ERROR, statusCode: 401 });
  });

  it('uploads a payment document as multipart form data', async () => {
    const { fetch, requests } = createFakeFetch(200, { id: 'doc_1', object: 'paymentDocument' });

    const asaas = createAsaasClient({ apiKey: 'key', environment: 'sandbox', fetch });

    await asaas.uploadPaymentDocument('pay_1', {
      file: new Uint8Array([37, 80, 68, 70]),
      fileName: 'demonstrativo-2026-10.pdf',
      type: 'INVOICE',
      availableAfterPayment: false,
    });

    const form = requests[0].init.body;

    expect(requests[0].url).toBe('https://api-sandbox.asaas.com/v3/payments/pay_1/documents');
    expect(form).toBeInstanceOf(FormData);
    expect(getHeader(requests[0], 'content-type')).toBeNull();

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const formData = form as FormData;
    const file = formData.get('file');

    expect(formData.get('type')).toBe('INVOICE');
    expect(formData.get('availableAfterPayment')).toBe('false');
    expect(file).toBeInstanceOf(Blob);
    expect((file as File).name).toBe('demonstrativo-2026-10.pdf');
  });
});
