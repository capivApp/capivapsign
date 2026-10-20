import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppErrorCode } from '../../errors/app-error';
import { getAsaasClient, getAsaasEnvironment } from './get-asaas-client';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getAsaasEnvironment', () => {
  it('only targets production when explicitly asked to', () => {
    vi.stubEnv('NEXT_PRIVATE_ASAAS_ENVIRONMENT', 'production');
    expect(getAsaasEnvironment()).toBe('production');

    vi.stubEnv('NEXT_PRIVATE_ASAAS_ENVIRONMENT', 'prod');
    expect(getAsaasEnvironment()).toBe('sandbox');

    vi.stubEnv('NEXT_PRIVATE_ASAAS_ENVIRONMENT', '');
    expect(getAsaasEnvironment()).toBe('sandbox');
  });
});

describe('getAsaasClient', () => {
  it('requires the API key', () => {
    vi.stubEnv('NEXT_PRIVATE_ASAAS_API_KEY', '');

    expect(() => getAsaasClient()).toThrowError(expect.objectContaining({ code: AppErrorCode.MISSING_ENV_VAR }));
  });

  it('builds a client when the key is set', () => {
    vi.stubEnv('NEXT_PRIVATE_ASAAS_API_KEY', 'key');

    expect(getAsaasClient().createPayment).toBeTypeOf('function');
  });
});
