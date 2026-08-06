import { stripe } from '@documenso/lib/server-only/stripe';

type CreateCustomerOptions = {
  name: string;
  email: string;

  /**
   * Organisation the customer belongs to. Used both as the Stripe idempotency
   * scope and as searchable metadata on the customer record.
   */
  organisationId: string;
};

/**
 * Create the Stripe customer that an organisation's subscription hangs off.
 *
 * Idempotent per organisation. Without a key, a signer double-clicking
 * "Subscribe" (or a retried request) creates two Stripe customers, and since
 * `Organisation.customerId` is unique only one can ever be recorded — leaving a
 * stray customer that later collects its own subscription and invoices. Stripe
 * replays the original response for a repeated key, so concurrent callers all
 * converge on the same customer.
 */
export const createCustomer = async ({ name, email, organisationId }: CreateCustomerOptions) => {
  return await stripe.customers.create(
    {
      name,
      email,
      metadata: {
        organisationId,
      },
    },
    {
      idempotencyKey: `organisation-customer-${organisationId}`,
    },
  );
};
