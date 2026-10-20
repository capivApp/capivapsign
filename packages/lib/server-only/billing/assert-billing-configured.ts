import { IS_BILLING_ENABLED } from '../../constants/app';
import { env } from '../../utils/env';
import { getAsaasEnvironment } from '../asaas/get-asaas-client';

/**
 * Fails fast at boot when billing is on but Asaas is not configured, instead of
 * at the first monthly charge. A missing webhook token only warns: charges are
 * still issued, they just stay unpaid in the app until Asaas can deliver events.
 */
export const assertBillingConfigured = (): void => {
  if (!IS_BILLING_ENABLED()) {
    return;
  }

  if (!env('NEXT_PRIVATE_ASAAS_API_KEY')) {
    throw new Error(
      'Billing is enabled (NEXT_PUBLIC_FEATURE_BILLING_ENABLED=true) but NEXT_PRIVATE_ASAAS_API_KEY is not set. ' +
        'Set the Asaas API key, or disable billing.',
    );
  }

  if (!env('NEXT_PRIVATE_ASAAS_WEBHOOK_TOKEN')) {
    console.warn(
      '[Billing] NEXT_PRIVATE_ASAAS_WEBHOOK_TOKEN is not set. Charges are issued, but payments never reach ' +
        'the app because Asaas webhooks are rejected without it.',
    );
  }

  if (env('NODE_ENV') === 'production' && getAsaasEnvironment() === 'sandbox') {
    console.warn('[Billing] Running in production against the Asaas sandbox. Real payments will not be collected.');
  }
};
