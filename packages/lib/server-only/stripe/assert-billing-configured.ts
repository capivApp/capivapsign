import { IS_BILLING_ENABLED } from '../../constants/app';
import { env } from '../../utils/env';

/**
 * Fail fast when billing is switched on but not actually configured.
 *
 * Without this the instance boots happily and the first signer to click
 * "Subscribe" gets an opaque Stripe auth error — the failure surfaces at the
 * worst possible moment, in front of a paying customer, instead of at deploy
 * time in front of an operator who can fix it.
 *
 * Missing keys throw; a missing webhook secret only warns, because checkout
 * still works — subscriptions just won't converge until Stripe can deliver
 * events, which is recoverable by setting the secret and replaying them.
 *
 * @throws when `NEXT_PUBLIC_FEATURE_BILLING_ENABLED` is true and the Stripe API
 *   key is absent.
 */
export const assertBillingConfigured = (): void => {
  if (!IS_BILLING_ENABLED()) {
    return;
  }

  const apiKey = env('NEXT_PRIVATE_STRIPE_API_KEY');

  if (!apiKey) {
    throw new Error(
      'Billing is enabled (NEXT_PUBLIC_FEATURE_BILLING_ENABLED=true) but NEXT_PRIVATE_STRIPE_API_KEY is not set. ' +
        'Set the Stripe secret key, or disable billing.',
    );
  }

  if (!env('NEXT_PRIVATE_STRIPE_WEBHOOK_SECRET')) {
    console.warn(
      '[Billing] NEXT_PRIVATE_STRIPE_WEBHOOK_SECRET is not set. Checkout will work, but subscription ' +
        'status will not stay in sync — Stripe webhooks are rejected without it.',
    );
  }

  if (env('NODE_ENV') === 'production' && apiKey.startsWith('sk_test_')) {
    console.warn('[Billing] Running in production with a Stripe TEST key. Real payments will not be collected.');
  }
};
