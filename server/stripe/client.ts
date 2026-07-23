import Stripe from 'stripe';
import { ENV } from '../_core/env';

if (!ENV.stripeSecretKey) {
  console.warn('[Stripe] STRIPE_SECRET_KEY is not set — Stripe features will be unavailable.');
}

export const stripe = new Stripe(ENV.stripeSecretKey, {
  apiVersion: '2026-04-22.dahlia',
  typescript: true,
});
