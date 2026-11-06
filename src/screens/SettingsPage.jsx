import { ChevronDown, FlaskConical } from 'lucide-react';
import { useState } from 'react';
import PayoutsSection, { PayoutControlRows } from './PayoutSetup';
import './OfferingsHome.css'; // the page frame and panels
import '../components/PrototypeControls.css';
import './SettingsPage.css';

// ------------------------------------------------------------
// Settings: the coach's account settings, opened from the avatar menu in
// the top bar (AccountMenu.jsx) and from Sales → Withdraw money when
// there's no verified bank account. One section for now, Bank account
// (PayoutSetup.jsx; "Bank account" rather than "Payouts", a word many
// coaches don't use); the next ones (business details for invoices, …)
// join SECTIONS as tabs.
//
//   Settings
//   Bank account
//   ━━━━━━━━━━━━
//   ┌ Bank account ──────────────────────────────────┐
//   │ Where your earnings are sent when you withdraw. │
//   │ (the setup, the check, or the verified account) │
//   └────────────────────────────────────────────────┘
//   (Prototype controls)
//
// onWithdraw(): go to Sales → Withdraw money
// ------------------------------------------------------------

const SECTIONS = [{ id: 'bank', label: 'Bank account' }];

export default function SettingsPage({ onWithdraw }) {
  const section = 'bank'; // the only one for now

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
          <h2 className="oh__panel-title">Bank account</h2>
          <p className="oh__panel-sub">Where your earnings are sent when you withdraw.</p>
        </div>
        <div className="settings__body">
          <PayoutsSection onWithdraw={onWithdraw} />
        </div>
      </section>

      <SettingsTestControls />
    </div>
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