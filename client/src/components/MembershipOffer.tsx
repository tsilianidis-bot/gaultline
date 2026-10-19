import { MARKETING_TIER_CARDS, PAID_PLANS_ON_SALE, PAID_PLANS_NOT_ON_SALE_COPY, CHECKOUT_ENABLED, CHECKOUT_COMING_SOON_LABEL, LIFETIME_TERMS, LIFETIME_FINAL_SALE_NOTICE } from '@shared/tiers';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { getLoginUrl, handleLoginCtaClick } from '@/const';

export default function MembershipOffer() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {MARKETING_TIER_CARDS.map(offer => <OfferCard key={offer.planId} offer={offer} />)}
    </div>
  );
}

function OfferCard({ offer }: { offer: (typeof MARKETING_TIER_CARDS)[number] }) {
  const { user } = useAuth();
  const plans = trpc.billing.getPlans.useQuery(undefined, { enabled: CHECKOUT_ENABLED && PAID_PLANS_ON_SALE });
  const checkout = trpc.billing.createCheckout.useMutation({
    onSuccess: data => { if (data.url) window.location.assign(data.url); },
  });
  const available = CHECKOUT_ENABLED && PAID_PLANS_ON_SALE && plans.data?.some(p => p.id === offer.planId && p.available);
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-[#65D6E5]/30 bg-[#070A0F] p-6 text-left sm:p-8" data-membership-offer>
      <p className="text-xs font-semibold tracking-widest text-[#65D6E5]">{offer.planId === 'lifetime' ? 'LIFETIME ACCESS' : 'PREMIUM FINANCIAL INTELLIGENCE'}</p>
      <h3 className="mt-3 text-2xl font-semibold text-white">{offer.marketingName}</h3>
      <p className="mt-5 text-4xl font-semibold text-white">{offer.price}</p>
      {offer.planId === 'lifetime' && <p className="mt-2 text-sm font-semibold text-amber-300" data-lifetime-final-sale>{LIFETIME_FINAL_SALE_NOTICE}</p>}
      <p className="mt-4 leading-relaxed text-[#C9D4E0]">Understand what is happening, why it matters, what may come next, what to watch, and how to think through your response.</p>
      <ul className="my-6 space-y-3 text-sm text-[#C9D4E0]">
        {offer.features.map(feature => <li key={feature} className="flex gap-3"><span aria-hidden="true" className="text-[#65D6E5]">✓</span>{feature}</li>)}
      </ul>
      {available && user ? (
        <button onClick={() => checkout.mutate({ planId: offer.planId, origin: window.location.origin })} disabled={checkout.isPending} className="w-full rounded-lg bg-[#65D6E5] px-5 py-3 font-semibold text-[#050608] disabled:opacity-50">{checkout.isPending ? 'Opening checkout…' : offer.ctaLabel}</button>
      ) : available ? (
        <a href={getLoginUrl() || undefined} onClick={handleLoginCtaClick} className="block rounded-lg bg-[#65D6E5] px-5 py-3 text-center font-semibold text-[#050608]">{offer.ctaLabel}</a>
      ) : PAID_PLANS_ON_SALE && !CHECKOUT_ENABLED ? (
        <button type="button" disabled aria-disabled="true" data-checkout-coming-soon className="w-full cursor-not-allowed rounded-lg bg-[#65D6E5]/40 px-5 py-3 font-semibold text-[#050608]">{CHECKOUT_COMING_SOON_LABEL}</button>
      ) : (
        <a href="/contact" className="block rounded-lg bg-[#65D6E5] px-5 py-3 text-center font-semibold text-[#050608]">Request membership</a>
      )}
      <p role="status" className="mt-4 text-sm leading-relaxed text-[#A8B4C2]">{available ? (offer.planId === 'lifetime' ? 'One-time payment.' : 'Monthly subscription.') : PAID_PLANS_ON_SALE ? 'Checkout opens soon. Nothing is charged today.' : `${PAID_PLANS_NOT_ON_SALE_COPY} Requesting membership does not charge you.`}</p>
      {offer.planId === 'lifetime' && (
        <div className="mt-5 rounded-lg border border-white/10 p-4 text-sm text-[#C9D4E0]" data-lifetime-terms>
          <p className="font-semibold text-white">Lifetime terms</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">{LIFETIME_TERMS.map(t => <li key={t}>{t}</li>)}</ol>
        </div>
      )}
      {checkout.error && <p role="alert" className="mt-3 text-sm text-red-300">{checkout.error.message}</p>}
      <a href="/pressure-index" className="mt-5 inline-block text-sm text-[#65D6E5] underline">View the limited public preview</a>
    </div>
  );
}
