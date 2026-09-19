import Stripe from 'stripe';
import { ENV } from '../_core/env';

const stripeSecretKey = ENV.stripeSecretKey?.trim() ?? '';

if (!stripeSecretKey) {
  console.warn('[Stripe] STRIPE_SECRET_KEY is not set — Stripe features will be unavailable.');
}

export const stripe: Stripe | null = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2026-04-22.dahlia',
      typescript: true,
    })
  : null;

export function requireStripe(): Stripe {
  if (!stripe) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return stripe;
}
