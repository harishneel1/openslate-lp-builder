import { ChevronDown, FlaskConical } from 'lucide-react';
import { useState } from 'react';
import PaymentDetails, { PayoutControlRows } from './PayoutSetup';
import './OfferingsHome.css'; // the page frame and panels
import '../components/PrototypeControls.css';
import './SettingsPage.css';

// ------------------------------------------------------------
// Settings: the coach's account settings, opened from the avatar menu in
// the top bar (AccountMenu.jsx) and from Sales → Withdraw money when
// they can't withdraw yet. One section for now, Payment details
// (PayoutSetup.jsx): who they are (PAN and Aadhaar, or their business),
// the bank account their money goes to, and what their invoices say.
// Other sections join SECTIONS as tabs.
//
//   Settings
//   Payment details
//   ━━━━━━━━━━━━━━━
//   ┌ Payment details ──────────────────────────────────────────────┐
//   │ Who you are and where we send your money. …                   │
//   │ ┌ Identity ─────────────────────┐   How payouts work          │
//   │ │ (start, checking, fix, done)  │   You can sell right away…  │
//   │ └───────────────────────────────┘   …                         │
//   │ ┌ Bank account ─────────────────┐                             │
//   │ └───────────────────────────────┘                             │
//   └───────────────────────────────────────────────────────────────┘
//   (Prototype controls)
//
// On a phone the help moves under the two parts.
//
// onWithdraw(): go to Sales → Withdraw money
// ------------------------------------------------------------

const SECTIONS = [{ id: 'payments', label: 'Payment details' }];

export default function SettingsPage({ onWithdraw }) {
  const section = 'payments'; // the only one for now

  return (
    <div className="oh settings">
      <h1 className="oh__title">Settings</h1>

      <div className="settings__tabs" role="tablist" aria-label="Settings">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            id={`settings-tab-${s.id}`}
            aria-selected={section === s.id}
            aria-controls={`settings-panel-${s.id}`}
            tabIndex={section === s.id ? 0 : -1}
            className="settings__tab"
          >
            {s.label}
          </button>
        ))}
      </div>

      <section
        className="oh__panel settings__panel"
        id={`settings-panel-${section}`}
        role="tabpanel"
        aria-labelledby={`settings-tab-${section}`}
      >
        <div className="oh__panel-head">
          <h2 className="oh__panel-title">Payment details</h2>
          <p className="oh__panel-sub">Who you are, where we send your money, and what your invoices say. You can withdraw once the first two are verified.</p>
        </div>
        <div className="settings__body settings__body--split">
          <PaymentDetails onWithdraw={onWithdraw} />
          <PayoutHelp />
        </div>
      </section>

      <SettingsTestControls />
    </div>
  );
}

// ---------- How payouts work, beside the parts ----------
function PayoutHelp() {
  return (
    <aside className="settings__help" aria-labelledby="settings-help-title">
      <h3 className="settings__help-title" id="settings-help-title">
        How payouts work
      </h3>
      <p>You can sell right away. What you earn waits safely in your balance until you withdraw it.</p>
      <p>
        To pay you, our payment partner has to verify who you are and that the bank account is yours. Your documents
        are used only for this.
      </p>
      <p>Photos or PDFs, up to 5 MB each. Make sure every word on the card can be read.</p>
    </aside>
  );
}

// ---------- Prototype controls: not part of the product ----------
const OPEN_KEY = 'pagebuilder:settings-controls-open';

function SettingsTestControls() {
  const [open, setOpen] = useState(() => {
    try {
      return sessionStorage.getItem(OPEN_KEY) === '1';
    } catch {
      return false;
    }
  });
  const toggle = () =>
    setOpen((o) => {
      try {
        sessionStorage.setItem(OPEN_KEY, o ? '0' : '1');
      } catch {
        // fine: it just won't be remembered
      }
      return !o;
    });
  return (
    <section className={`proto settings__proto ${open ? 'proto--open' : ''}`} aria-label="Prototype controls">
      <button type="button" className="proto__head" aria-expanded={open} onClick={toggle}>
        <FlaskConical size={16} aria-hidden="true" />
        <span className="proto__title">Prototype controls</span>
        <span className="proto__tag">For testing, not part of the product</span>
        <ChevronDown size={16} className="proto__chevron" aria-hidden="true" />
      </button>
      {open && (
        <div className="proto__body">
          <PayoutControlRows />
        </div>
      )}
    </section>
  );
}