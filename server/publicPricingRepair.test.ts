import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PRICING_PLANS } from '../shared/tiers';

const root = resolve(import.meta.dirname, '..');
const read = (relativePath: string) => readFileSync(resolve(root, relativePath), 'utf8');

describe('surgical public FAULTLINE brand and pricing repair', () => {
  it('uses the requested monthly public plan amounts while preserving internal tier IDs', () => {
    expect(PRICING_PLANS.founding.amountCents).toBe(4900);
    expect(PRICING_PLANS.core.amountCents).toBe(5900);
    expect(PRICING_PLANS.premium.amountCents).toBe(9900);
    expect(PRICING_PLANS.core.planId).toBe('core');
    expect(PRICING_PLANS.premium.planId).toBe('premium');
  });

  it('initializes Product Experience color constants before public pricing configuration', () => {
    const productExperience = read('client/src/components/ProductExperience.tsx');
    const goldConstant = productExperience.indexOf('const GOLD');
    const publicPricing = productExperience.indexOf('const PUBLIC_PRICING');
    expect(goldConstant).toBeGreaterThanOrEqual(0);
    expect(publicPricing).toBeGreaterThan(goldConstant);
  });

  it('does not publicly offer annual or lifetime checkout pricing', () => {
    expect(PRICING_PLANS.core_annual.available).toBe(false);
    expect(PRICING_PLANS.premium_annual.available).toBe(false);
    expect(PRICING_PLANS.lifetime.available).toBe(false);

    const productExperience = read('client/src/components/ProductExperience.tsx');
    const marketing = read('client/src/pages/MarketingSite.tsx');
    expect(productExperience).not.toContain('Get Lifetime Access');
    expect(marketing).not.toContain('FOUNDING LIFETIME');
    expect(marketing).not.toContain('$9.99');
  });

  it('uses personal founder copy and removes stale AlphaPulse branding from active public source', () => {
    const productExperience = read('client/src/components/ProductExperience.tsx');
    const about = read('client/src/pages/About.tsx');
    const marketing = read('client/src/pages/MarketingSite.tsx');
    const publicSource = `${productExperience}\n${about}\n${marketing}`;

    expect(publicSource).toContain('I built FAULTLINE because I wish I had a tool like this the first time I made life-changing gains.');
    expect(publicSource).toContain('Knowing what to do after you’ve found them can be.');
    expect(publicSource).not.toMatch(/AlphaPulse|Alpha Pulse/i);
  });

  it('blocks checkout unless configured Stripe price metadata exactly matches the public plan', () => {
    const products = read('server/stripe/products.ts');
    const billing = read('server/routers/billing.ts');
    expect(products).toContain('verifyStripePlanConfiguration');
    expect(products).toContain('price.unit_amount === plan.amount');
    expect(products).toContain('product?.name === plan.name');
    expect(billing).toContain('const verification = await verifyStripePlanConfiguration(plan);');
    expect(billing).toContain('Checkout is unavailable until Stripe configuration is verified.');
  });
});
