import Stripe from 'stripe';
import { ENV } from './env';
import { logger } from './logger';

/**
 * Stripe Payment Gateway Integration
 * Provides payment processing capabilities using Stripe
 */

// Initialize Stripe client (will be undefined if credentials not provided)
let stripeClient: Stripe | undefined;

if (ENV.stripeSecretKey) {
  try {
    stripeClient = new Stripe(ENV.stripeSecretKey, {
      apiVersion: '2026-02-25.clover',
    });
    logger.info('[Stripe] Client initialized successfully');
  } catch (error) {
    logger.error('[Stripe] Failed to initialize client:', error);
  }
} else {
  logger.warn('[Stripe] STRIPE_SECRET_KEY not provided - Stripe payments disabled');
}

export interface StripePaymentIntent {
  success: boolean;
  paymentIntentId?: string;
  clientSecret?: string;
  error?: string;
  requiresAction?: boolean;
  status?: string;
}

export interface StripePaymentResult {
  success: boolean;
  paymentIntentId?: string;
  transactionId?: string;
  error?: string;
  cardLast4?: string;
  cardBrand?: string;
  amount?: number;
  currency?: string;
}

/**
 * Create a Stripe Payment Intent
 */
export async function createStripePaymentIntent(
  amount: number,
  currency: string = 'usd',
  metadata?: Record<string, string>,
  idempotencyKey?: string
): Promise<StripePaymentIntent> {
  if (!stripeClient) {
    return {
      success: false,
      error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.',
    };
  }

  try {
    // Amount must be in cents for Stripe
    const amountInCents = Math.round(amount * 100);

    const paymentIntent = await stripeClient.paymentIntents.create(
      {
        amount: amountInCents,
        currency,
        metadata: metadata || {},
        automatic_payment_methods: {
          enabled: true,
        },
      },
      idempotencyKey ? { idempotencyKey } : undefined,
    );

    return {
      success: true,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret || undefined,
      status: paymentIntent.status,
    };
  } catch (error: any) {
    logger.error('[Stripe] Payment Intent creation failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to create payment intent',
    };
  }
}

/**
 * Confirm a Stripe Payment Intent
 */
export async function confirmStripePayment(
  paymentIntentId: string,
  paymentMethodId?: string
): Promise<StripePaymentResult> {
  if (!stripeClient) {
    return {
      success: false,
      error: 'Stripe is not configured',
    };
  }

  try {
    const confirmed = await stripeClient.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethodId,
    });

    if (confirmed.status === 'succeeded') {
      const paymentMethod = confirmed.payment_method;
      let cardLast4: string | undefined;
      let cardBrand: string | undefined;

      if (typeof paymentMethod === 'string') {
        // Fetch full payment method details
        const pm = await stripeClient.paymentMethods.retrieve(paymentMethod);
        cardLast4 = pm.card?.last4;
        cardBrand = pm.card?.brand;
      } else if (paymentMethod?.card) {
        cardLast4 = paymentMethod.card.last4;
        cardBrand = paymentMethod.card.brand;
      }

      return {
        success: true,
        paymentIntentId: confirmed.id,
        transactionId: confirmed.id,
        cardLast4,
        cardBrand,
        amount: confirmed.amount / 100, // Convert from cents to dollars
        currency: confirmed.currency,
      };
    } else {
      return {
        success: false,
        error: `Payment status: ${confirmed.status}`,
      };
    }
  } catch (error: any) {
    logger.error('[Stripe] Payment confirmation failed:', error);
    return {
      success: false,
      error: error.message || 'Payment confirmation failed',
    };
  }
}

/**
 * Retrieve payment intent details
 */
export async function getStripePaymentIntent(
  paymentIntentId: string
): Promise<Stripe.PaymentIntent | null> {
  if (!stripeClient) {
    return null;
  }

  try {
    return await stripeClient.paymentIntents.retrieve(paymentIntentId);
  } catch (error) {
    logger.error('[Stripe] Failed to retrieve payment intent:', error);
    return null;
  }
}

/**
 * Create a Stripe Customer for saved payment methods
 */
export async function createStripeCustomer(
  email: string,
  name: string,
  metadata?: Record<string, string>
): Promise<{ success: boolean; customerId?: string; error?: string }> {
  if (!stripeClient) {
    return {
      success: false,
      error: 'Stripe is not configured',
    };
  }

  try {
    const customer = await stripeClient.customers.create({
      email,
      name,
      metadata: metadata || {},
    });

    return {
      success: true,
      customerId: customer.id,
    };
  } catch (error: any) {
    logger.error('[Stripe] Customer creation failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to create customer',
    };
  }
}

/**
 * Attach payment method to customer
 */
export async function attachPaymentMethodToCustomer(
  paymentMethodId: string,
  customerId: string
): Promise<{ success: boolean; error?: string; last4?: string; brand?: string }> {
  if (!stripeClient) {
    return {
      success: false,
      error: 'Stripe is not configured',
    };
  }

  try {
    const pm = await stripeClient.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    return {
      success: true,
      last4: pm.card?.last4 || undefined,
      brand: pm.card?.brand || undefined,
    };
  } catch (error: any) {
    logger.error('[Stripe] Payment method attachment failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to attach payment method',
    };
  }
}

/**
 * Process a payment with saved payment method
 */
export async function processStripePayment(
  amount: number,
  customerId: string,
  paymentMethodId: string,
  metadata?: Record<string, string>,
  idempotencyKey?: string
): Promise<StripePaymentResult> {
  if (!stripeClient) {
    return {
      success: false,
      error: 'Stripe is not configured',
    };
  }

  try {
    const amountInCents = Math.round(amount * 100);

    const paymentIntent = await stripeClient.paymentIntents.create(
      {
        amount: amountInCents,
        currency: 'usd',
        customer: customerId,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        metadata: metadata || {},
      },
      idempotencyKey ? { idempotencyKey } : undefined,
    );

    if (paymentIntent.status === 'succeeded') {
      const pm = await stripeClient.paymentMethods.retrieve(paymentMethodId);
      return {
        success: true,
        paymentIntentId: paymentIntent.id,
        transactionId: paymentIntent.id,
        cardLast4: pm.card?.last4,
        cardBrand: pm.card?.brand,
        amount: amount,
        currency: 'usd',
      };
    } else {
      return {
        success: false,
        error: `Payment status: ${paymentIntent.status}`,
      };
    }
  } catch (error: any) {
    logger.error('[Stripe] Payment processing failed:', error);
    return {
      success: false,
      error: error.message || 'Payment processing failed',
    };
  }
}

export { stripeClient };
