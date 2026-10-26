import Stripe from 'stripe';
import { ENV } from '../_core/env';
import { permittedStripeSecretKey, resolveStripeRuntimeMode } from './mode';

/** Below the 90s webhook reclaim window so a hung Stripe call cannot outlive the claim. */
export const STRIPE_CLIENT_TIMEOUT_MS = 15_000;

const configuredStripeSecretKey = ENV.stripeSecretKey?.trim() ?? '';
export const stripeRuntimeMode = resolveStripeRuntimeMode(configuredStripeSecretKey);
const stripeSecretKey = permittedStripeSecretKey(configuredStripeSecretKey);

if (configuredStripeSecretKey && !stripeSecretKey) {
  console.warn('[Stripe] Live or unrecognized Stripe key refused; test mode is required until FAULTLINE_STRIPE_LAUNCH_AUTHORIZED=true.');
} else if (!stripeSecretKey) {
  console.warn('[Stripe] STRIPE_SECRET_KEY is not set — Stripe features will be unavailable.');
}

export const stripe: Stripe | null = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2026-04-22.dahlia' as string as NonNullable<ConstructorParameters<typeof Stripe>[1]>['apiVersion'],
      typescript: true,
      // Stay under the webhook reclaim window (90s) so a hung Stripe call cannot
      // still be writing an entitlement when a second delivery reclaims the claim.
      timeout: STRIPE_CLIENT_TIMEOUT_MS,
    })
  : null;

export function requireStripe(): Stripe {
  if (!stripe) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return stripe;
}
