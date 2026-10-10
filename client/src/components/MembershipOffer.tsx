import { MARKETING_TIER_CARDS, PAID_PLANS_ON_SALE, PAID_PLANS_NOT_ON_SALE_COPY } from '@shared/tiers';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { getLoginUrl, handleLoginCtaClick } from '@/const';

export default function MembershipOffer() {
  const offer = MARKETING_TIER_CARDS[0];
  const { user } = useAuth();
  const plans = trpc.billing.getPlans.useQuery(undefined, { enabled: PAID_PLANS_ON_SALE });
  const checkout = trpc.billing.createCheckout.useMutation({
    onSuccess: data => { if (data.url) window.location.assign(data.url); },
  });
  const available = PAID_PLANS_ON_SALE && plans.data?.some(p => p.id === offer.planId && p.available);
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-[#65D6E5]/30 bg-[#070A0F] p-6 text-left sm:p-8" data-membership-offer>
      <p className="text-xs font-semibold tracking-widest text-[#65D6E5]">PREMIUM FINANCIAL INTELLIGENCE</p>
      <h3 className="mt-3 text-2xl font-semibold text-white">{offer.marketingName}</h3>
      <p className="mt-5 text-4xl font-semibold text-white">{offer.price}</p>
      <p className="mt-4 leading-relaxed text-[#C9D4E0]">Understand what is happening, why it matters, what may come next, what to watch, and how to think through your response.</p>
      <ul className="my-6 space-y-3 text-sm text-[#C9D4E0]">
        {offer.features.map(feature => <li key={feature} className="flex gap-3"><span aria-hidden="true" className="text-[#65D6E5]">✓</span>{feature}</li>)}
      </ul>
      {available && user ? (
        <button onClick={() => checkout.mutate({ planId: offer.planId, origin: window.location.origin })} disabled={checkout.isPending} className="w-full rounded-lg bg-[#65D6E5] px-5 py-3 font-semibold text-[#050608] disabled:opacity-50">{checkout.isPending ? 'Opening checkout…' : 'Join FAULTLINE'}</button>
      ) : available ? (
        <a href={getLoginUrl() || undefined} onClick={handleLoginCtaClick} className="block rounded-lg bg-[#65D6E5] px-5 py-3 text-center font-semibold text-[#050608]">Join FAULTLINE</a>
      ) : (
        <a href="/contact" className="block rounded-lg bg-[#65D6E5] px-5 py-3 text-center font-semibold text-[#050608]">Request membership</a>
      )}
      <p role="status" className="mt-4 text-sm leading-relaxed text-[#A8B4C2]">{available ? 'Monthly subscription.' : `${PAID_PLANS_NOT_ON_SALE_COPY} Requesting membership does not charge you.`}</p>
      {checkout.error && <p role="alert" className="mt-3 text-sm text-red-300">{checkout.error.message}</p>}
      <a href="/pressure-index" className="mt-5 inline-block text-sm text-[#65D6E5] underline">View the limited public preview</a>
    </div>
  );
}
