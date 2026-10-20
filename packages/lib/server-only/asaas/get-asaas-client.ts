import { env, requireEnv } from '../../utils/env';
import { createAsaasClient } from './asaas-client';
import type { AsaasEnvironment } from './types';

/**
 * Anything other than an explicit `production` targets the sandbox: a live key
 * sent to the sandbox fails loudly with 401, while the opposite would bill for
 * real.
 */
export const getAsaasEnvironment = (): AsaasEnvironment =>
  env('NEXT_PRIVATE_ASAAS_ENVIRONMENT') === 'production' ? 'production' : 'sandbox';

export const getAsaasClient = () =>
  createAsaasClient({
    apiKey: requireEnv('NEXT_PRIVATE_ASAAS_API_KEY'),
    environment: getAsaasEnvironment(),
  });
