import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { assertBillingConfigured } from './assert-billing-configured';

const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

beforeEach(() => {
  warn.mockClear();
  vi.stubEnv('NEXT_PUBLIC_FEATURE_BILLING_ENABLED', 'true');
  vi.stubEnv('NEXT_PRIVATE_ASAAS_API_KEY', 'key');
  vi.stubEnv('NEXT_PRIVATE_ASAAS_WEBHOOK_TOKEN', 'token');
  vi.stubEnv('NEXT_PRIVATE_ASAAS_ENVIRONMENT', 'production');
  vi.stubEnv('NODE_ENV', 'production');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('assertBillingConfigured', () => {
  it('accepts a complete configuration silently', () => {
    expect(() => assertBillingConfigured()).not.toThrow();
    expect(warn).not.toHaveBeenCalled();
  });

  it('ignores missing keys while billing is off', () => {
    vi.stubEnv('NEXT_PUBLIC_FEATURE_BILLING_ENABLED', '');
    vi.stubEnv('NEXT_PRIVATE_ASAAS_API_KEY', '');

    expect(() => assertBillingConfigured()).not.toThrow();
  });

  it('refuses to boot with billing on and no API key', () => {
    vi.stubEnv('NEXT_PRIVATE_ASAAS_API_KEY', '');

    expect(() => assertBillingConfigured()).toThrow(/NEXT_PRIVATE_ASAAS_API_KEY/);
  });

  it('warns when the webhook token is missing', () => {
    vi.stubEnv('NEXT_PRIVATE_ASAAS_WEBHOOK_TOKEN', '');

    assertBillingConfigured();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('NEXT_PRIVATE_ASAAS_WEBHOOK_TOKEN'));
  });

  it('warns when production runs against the Asaas sandbox', () => {
    vi.stubEnv('NEXT_PRIVATE_ASAAS_ENVIRONMENT', 'sandbox');

    assertBillingConfigured();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('sandbox'));
  });
});
