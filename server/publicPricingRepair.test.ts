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

  it('keeps marketing JSON-LD on the public ladder and does not advertise Lifetime $299', () => {
    const homepage = read('client/index.html');
    const softwareApp = homepage.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(softwareApp?.[1]).toBeTruthy();
    const schema = JSON.parse(softwareApp![1]);
    expect(schema['@type']).toBe('SoftwareApplication');
    const offerNames = schema.offers.map((offer: { name: string }) => offer.name);
    const offerPrices = schema.offers.map((offer: { price: string }) => offer.price);
    expect(offerNames).toEqual(['Free', 'Trader', 'Power', 'Founding']);
    expect(offerPrices).toEqual(['0', '59.00', '99.00', '49.00']);
    expect(homepage).not.toContain('Founding Lifetime');
    expect(homepage).not.toContain('299.00');
    expect(homepage).not.toContain('$299');
    expect(homepage).not.toContain('"9.99"');
  });

  it('keeps annual checkout unavailable and does not advertise Lifetime publicly', () => {
    expect(PRICING_PLANS.core_annual.available).toBe(false);
    expect(PRICING_PLANS.premium_annual.available).toBe(false);
    expect(PRICING_PLANS.lifetime.available).toBe(false);

    const productExperience = read('client/src/components/ProductExperience.tsx');
    const marketing = read('client/src/pages/MarketingSite.tsx');
    const app = read('client/src/App.tsx');
    expect(productExperience).not.toContain('LIMITED TIME LIFETIME ACCESS');
    expect(productExperience).not.toContain('GET LIFETIME ACCESS — $299');
    expect(productExperience).not.toContain("handlePricingInterest('Lifetime Access — $299')");
    expect(productExperience).toContain('LOCK IN FOUNDER RATE');
    expect(productExperience).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))'");
    expect(marketing).toContain('MARKETING_TIER_CARDS');
    expect(marketing).toContain('trader.marketingName');
    expect(marketing).toContain('founding.marketingName');
    expect(marketing).toContain('trader.ctaLabel');
    expect(marketing).toContain('power.ctaLabel');
    expect(marketing).toContain('founding.ctaLabel');
    expect(marketing).not.toContain('GET FOUNDING LIFETIME ACCESS — $299');
    expect(marketing).not.toContain('FOUNDING LIFETIME ACCESS');
    expect(marketing).not.toContain('$299');
    expect(marketing).not.toContain('Observer');
    expect(marketing).not.toMatch(/\bCore access\b/);
    expect(marketing).not.toContain('Everything in Pro');
    expect(app).not.toMatch(/<ProductExperience\b/);
    expect(app).not.toContain("planId: 'lifetime'");
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

  it('keeps the active Product Experience founder attribution as JT and removes RICHARD ROPER from public surfaces', () => {
    const productExperience = read('client/src/components/ProductExperience.tsx');
    const marketing = read('client/src/pages/MarketingSite.tsx');
    const about = read('client/src/pages/About.tsx');
    expect(productExperience).toContain('>JT</div>');
    expect(productExperience).not.toContain('RICHARD ROPER');
    expect(marketing).not.toContain('RICHARD ROPER');
    expect(about).toContain('JT');
    expect(about).not.toContain('RICHARD ROPER');
    expect(read('client/src/pages/Press.tsx')).not.toContain('RICHARD ROPER');
    expect(read('client/src/pages/TrustCenter.tsx')).not.toContain('RICHARD ROPER');
  });

  it('blocks checkout unless configured Stripe price metadata exactly matches the public plan', () => {
    const products = read('server/stripe/products.ts');
    const billing = read('server/routers/billing.ts');
    expect(products).toContain('verifyStripePlanConfiguration');
    expect(products).toContain('price.unit_amount === plan.amount');
    expect(products).toContain('product.name === plan.name');
    expect(billing).toContain('const verification = await verifyStripePlanConfiguration(plan);');
    expect(billing).toContain('Checkout is unavailable until Stripe configuration is verified.');
    expect(billing).toContain('PRICING_PLANS[planId].available && !!priceId');
    expect(billing).not.toMatch(/available:\s*!!p\.priceId/);
  });
});
