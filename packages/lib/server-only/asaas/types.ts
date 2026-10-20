/**
 * Shapes of the Asaas v3 API resources CapivaSign uses. Only the fields we read
 * or send are typed; Asaas adds fields to payloads over time, so unknown ones
 * are ignored rather than rejected.
 *
 * @see https://docs.asaas.com/reference
 */

export const ASAAS_ENVIRONMENTS = ['sandbox', 'production'] as const;

export type AsaasEnvironment = (typeof ASAAS_ENVIRONMENTS)[number];

export type AsaasErrorResponse = {
  errors?: { code: string; description: string }[];
};

export type AsaasCustomerInput = {
  name: string;
  /** No mask (see normalizeCpfCnpj). Asaas refuses to issue charges without it. */
  cpfCnpj: string;
  email?: string;
  externalReference?: string;
};

export type AsaasCustomer = AsaasCustomerInput & {
  id: string;
};

/** UNDEFINED lets the payer pick Pix, boleto or card on the invoice page. */
export type AsaasBillingType = 'UNDEFINED' | 'BOLETO' | 'CREDIT_CARD' | 'PIX';

export type AsaasPaymentInput = {
  customer: string;
  billingType: AsaasBillingType;
  /** In reais, not cents. */
  value: number;
  /** YYYY-MM-DD. */
  dueDate: string;
  /** Shown on the invoice and boleto. Max 500 characters. */
  description?: string;
  externalReference?: string;
};

export type AsaasPaymentStatus =
  | 'PENDING'
  | 'RECEIVED'
  | 'CONFIRMED'
  | 'OVERDUE'
  | 'REFUNDED'
  | 'RECEIVED_IN_CASH'
  | 'REFUND_REQUESTED'
  | 'REFUND_IN_PROGRESS'
  | 'CHARGEBACK_REQUESTED'
  | 'CHARGEBACK_DISPUTE'
  | 'AWAITING_CHARGEBACK_REVERSAL'
  | 'DUNNING_REQUESTED'
  | 'DUNNING_RECEIVED'
  | 'AWAITING_RISK_ANALYSIS';

export type AsaasPayment = {
  id: string;
  customer: string;
  status: AsaasPaymentStatus;
  value: number;
  dueDate: string;
  invoiceUrl: string;
  bankSlipUrl?: string | null;
  externalReference?: string | null;
  deleted?: boolean;
};

export type AsaasPaymentDocumentType =
  | 'INVOICE'
  | 'CONTRACT'
  | 'MEDIA'
  | 'DOCUMENT'
  | 'SPREADSHEET'
  | 'PROGRAM'
  | 'OTHER';

export type AsaasPaymentDocumentInput = {
  file: Uint8Array;
  fileName: string;
  type: AsaasPaymentDocumentType;
  /** false = the payer can download it before paying. */
  availableAfterPayment: boolean;
};

export type AsaasPaymentDocument = {
  id: string;
  name: string;
  type: AsaasPaymentDocumentType;
};
