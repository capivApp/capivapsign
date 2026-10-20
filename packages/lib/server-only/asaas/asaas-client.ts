import { AppError, AppErrorCode } from '../../errors/app-error';
import type {
  AsaasCustomer,
  AsaasCustomerInput,
  AsaasEnvironment,
  AsaasErrorResponse,
  AsaasPayment,
  AsaasPaymentDocument,
  AsaasPaymentDocumentInput,
  AsaasPaymentInput,
} from './types';

const ASAAS_BASE_URL: Record<AsaasEnvironment, string> = {
  sandbox: 'https://api-sandbox.asaas.com/v3',
  production: 'https://api.asaas.com/v3',
};

// 400 is Asaas rejecting what we sent (invalid CPF/CNPJ, missing field): the
// description is meant for the payer, so it travels as the user message.
const getErrorCode = (status: number) => (status === 400 ? AppErrorCode.INVALID_REQUEST : AppErrorCode.UNKNOWN_ERROR);

const buildAsaasError = async (response: Response) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const body = (await response.json().catch(() => ({}))) as AsaasErrorResponse;
  const errors = body.errors ?? [];

  return new AppError(getErrorCode(response.status), {
    message: `Asaas request failed (${response.status}): ${errors.map((error) => error.code).join(', ')}`,
    userMessage: errors.map((error) => error.description).join(' ') || undefined,
    statusCode: response.status,
  });
};

export type CreateAsaasClientOptions = {
  apiKey: string;
  environment: AsaasEnvironment;
  fetch?: typeof globalThis.fetch;
};

export const createAsaasClient = ({ apiKey, environment, fetch = globalThis.fetch }: CreateAsaasClientOptions) => {
  const baseUrl = ASAAS_BASE_URL[environment];

  const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const headers = new Headers(init.headers);

    headers.set('access_token', apiKey);
    headers.set('User-Agent', 'CapivaSign');

    const response = await fetch(`${baseUrl}${path}`, { ...init, headers });

    if (!response.ok) {
      throw await buildAsaasError(response);
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return (await response.json()) as T;
  };

  const sendJson = <T>(method: 'POST' | 'PUT', path: string, body: unknown) =>
    request<T>(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  const buildDocumentForm = ({ file, fileName, type, availableAfterPayment }: AsaasPaymentDocumentInput) => {
    const form = new FormData();

    form.append('file', new Blob([file], { type: 'application/pdf' }), fileName);
    form.append('type', type);
    form.append('availableAfterPayment', String(availableAfterPayment));

    return form;
  };

  return {
    createCustomer: (input: AsaasCustomerInput) => sendJson<AsaasCustomer>('POST', '/customers', input),

    updateCustomer: (customerId: string, input: Partial<AsaasCustomerInput>) =>
      sendJson<AsaasCustomer>('PUT', `/customers/${customerId}`, input),

    createPayment: (input: AsaasPaymentInput) => sendJson<AsaasPayment>('POST', '/payments', input),

    getPayment: (paymentId: string) => request<AsaasPayment>(`/payments/${paymentId}`),

    // No Content-Type: fetch sets the multipart boundary itself.
    uploadPaymentDocument: (paymentId: string, input: AsaasPaymentDocumentInput) =>
      request<AsaasPaymentDocument>(`/payments/${paymentId}/documents`, {
        method: 'POST',
        body: buildDocumentForm(input),
      }),
  };
};

export type AsaasClient = ReturnType<typeof createAsaasClient>;
