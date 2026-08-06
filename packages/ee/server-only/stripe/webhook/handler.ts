import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import type { Stripe } from '@documenso/lib/server-only/stripe';
import { stripe } from '@documenso/lib/server-only/stripe';
import { env } from '@documenso/lib/utils/env';

import { syncStripeCustomerSubscription } from '../sync-stripe-customer-subscription';

type StripeWebhookResponse = {
  success: boolean;
  message: string;
};

/**
 * Events that trigger a sync of the customer's subscription state.
 *
 * The event payload is never trusted beyond extracting the customer ID,
 * the sync function fetches the current truth from Stripe.
 */
const SYNCED_EVENT_TYPES: string[] = [
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'checkout.session.completed',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
];

export const stripeWebhookHandler = async (req: Request): Promise<Response> => {
  try {
    // Acknowledge with 2xx when this instance simply isn't the one handling
    // billing. A 5xx would put Stripe into its retry schedule and redeliver the
    // same event for days against an endpoint that will never process it.
    if (!IS_BILLING_ENABLED()) {
      return Response.json(
        {
          success: true,
          message: 'Billing is disabled, event ignored',
        } satisfies StripeWebhookResponse,
        { status: 200 },
      );
    }

    const webhookSecret = env('NEXT_PRIVATE_STRIPE_WEBHOOK_SECRET');

    if (!webhookSecret) {
      throw new Error('Missing Stripe webhook secret');
    }

    const signature =
      typeof req.headers.get('stripe-signature') === 'string' ? req.headers.get('stripe-signature') : '';

    if (!signature) {
      return Response.json(
        {
          success: false,
          message: 'No signature found in request',
        } satisfies StripeWebhookResponse,
        { status: 400 },
      );
    }

    const payload = await req.text();

    if (!payload) {
      return Response.json(
        {
          success: false,
          message: 'No payload found in request',
        } satisfies StripeWebhookResponse,
        { status: 400 },
      );
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err) {
      // A bad signature can never become valid on redelivery, so answer 400 to
      // take it out of Stripe's retry schedule instead of letting it fall into
      // the 500 path below.
      console.error('Stripe webhook signature verification failed:', err);

      return Response.json(
        {
          success: false,
          message: 'Invalid signature',
        } satisfies StripeWebhookResponse,
        { status: 400 },
      );
    }

    if (!SYNCED_EVENT_TYPES.includes(event.type)) {
      return Response.json(
        {
          success: true,
          message: 'Webhook received',
        } satisfies StripeWebhookResponse,
        { status: 200 },
      );
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const eventObject = event.data.object as { customer?: string | Stripe.Customer | null };

    const customerId = typeof eventObject.customer === 'string' ? eventObject.customer : eventObject.customer?.id;

    if (!customerId) {
      console.error(`No customer found on ${event.type} event ${event.id}, nothing to sync`);

      return Response.json(
        {
          success: true,
          message: 'Webhook received',
        } satisfies StripeWebhookResponse,
        { status: 200 },
      );
    }

    await syncStripeCustomerSubscription({ customerId });

    return Response.json(
      {
        success: true,
        message: 'Webhook received',
      } satisfies StripeWebhookResponse,
      { status: 200 },
    );
  } catch (err) {
    console.error(err);

    return Response.json(
      {
        success: false,
        message: 'Unknown error',
      } satisfies StripeWebhookResponse,
      { status: 500 },
    );
  }
};
