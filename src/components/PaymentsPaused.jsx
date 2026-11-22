import { Clock } from 'lucide-react';
import './PaymentsPaused.css';

// ------------------------------------------------------------
// What a buyer sees instead of paying, while the coach can't take
// payments yet (their KYC isn't verified: canTakePayments in
// data/payouts.js). Used on every paid checkout: a 1:1 call's booking page
// and checkout, a contract or course's checkout, a paid webinar's sign-up,
// and a live class's join page.
//
//   (🕒)  Payments aren't open yet
//         Harish Neel isn't taking payments just yet. Please check back
//         soon, or contact them directly.
//
// It never says why (KYC is the coach's business, not the buyer's), and
// the rest of the page stays as it is, so the link still looks right.
// Free offerings never show it.
//
// name: the coach's name, as the page shows it
// ------------------------------------------------------------
export default function PaymentsPaused({ name }) {
  return (
    <div className="paused" role="status">
      <span className="paused__icon" aria-hidden="true">
        <Clock size={20} />
      </span>
      <div>
        <p className="paused__title">Payments aren’t open yet</p>
        <p className="paused__text">
          {name || 'This coach'} isn’t taking payments just yet. Please check back soon, or contact them directly.
        </p>
      </div>
    </div>
  );
}
