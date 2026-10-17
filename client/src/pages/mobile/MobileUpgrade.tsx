import MembershipOffer from '@/components/MembershipOffer';

export default function MobileUpgrade() {
  return <div className="px-4 py-5 pb-8">
    <a href="/mobile/account" className="mb-5 inline-block text-sm text-[#A8B4C2]">← Back to account</a>
    <MembershipOffer />
    <p className="mt-5 text-xs leading-relaxed text-[#A8B4C2]">FAULTLINE provides market intelligence and risk analysis, not personalized financial advice.</p>
  </div>;
}
