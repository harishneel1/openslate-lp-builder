import { ShieldCheck } from 'lucide-react';
import { usePayout } from '../screens/PayoutSetup';
import './KycBanner.css';

// ------------------------------------------------------------
// The KYC banner: a strip under the top bar, across the coach's app,
// until their KYC is verified. Getting paid starts here, so it's always
// on screen: no close button, and no shrinking.
//
//   [🛡] Complete your KYC to start receiving payments.   [Complete KYC]
//
// One message the whole way through. It never says how far they've got
// (not started, sent, being checked): that's on Payment details, where
// the button goes.
//
// Not shown in focus mode (a webinar, call, course or batch open; AppLayout
// leaves it out there), nor on Settings → Payment details itself, where
// they're already doing it (hidden).
//
// Gone once identity is verified (payoutState().kyc.status, data/payouts.js).
// Prototype controls on Payment details: "New coach, nothing added" brings
// it back, "Demo, all verified" takes it away.
//
// onOpen(): go to Settings → Payment details
// hidden: true on Payment details
// ------------------------------------------------------------
export default function KycBanner({ onOpen, hidden = false }) {
  const payout = usePayout();
  if (hidden || payout.kyc.status === 'verified') return null;

  return (
    <div className="kycbanner" role="region" aria-label="KYC">
      <span className="kycbanner__icon" aria-hidden="true">
        <ShieldCheck size={18} />
      </span>
      <p className="kycbanner__text">Complete your KYC to start receiving payments.</p>
      <button type="button" className="kycbanner__btn" onClick={onOpen}>
        Complete KYC
      </button>
    </div>
  );
}
