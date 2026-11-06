import { useState } from 'react';
import TransactionsTab from './TransactionsTab';
import WithdrawalsTab from './WithdrawalsTab';
import { SalesTestControls } from './SalesShared';
import './OfferingsHome.css'; // the page frame, panels and buttons, as on 1:1 calls
import './SalesPage.css';

// ------------------------------------------------------------
// The Sales tab: the coach's money with us, laid out like TagMango's
// Sales section but with only what's useful. Sub-tabs across the top:
// Withdraw money (WithdrawalsTab.jsx) first, since what they can take out
// is what coaches open Sales for, then Transactions (TransactionsTab.jsx).
// Opening Sales always lands on Withdraw money. Arrow keys move between tabs.
//
//   Sales
//   Withdraw money   Transactions
//   ━━━━━━━━━━━━━━
//   (the tab's content)
//   (Prototype controls, for both tabs)
//
// webinars: every webinar session (App's funnels of type 'webinar'), so
// real paid sign-ups, free sign-ups and refunds show
// ------------------------------------------------------------

const TABS = [
  { id: 'withdrawals', label: 'Withdraw money' },
  { id: 'transactions', label: 'Transactions' },
];

export default function SalesPage({ webinars = [] }) {
  // Always starts on Withdraw money
  const [tab, setTab] = useState(TABS[0].id);
  const choose = setTab;

  const onKey = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const at = TABS.findIndex((t) => t.id === tab);
    const next = TABS[(at + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length].id;
    choose(next);
    requestAnimationFrame(() => document.getElementById(`sales-tab-${next}`)?.focus());
  };

  return (
    <div className="oh sales">
      <h1 className="oh__title">Sales</h1>

      <div className="sales__tabs" role="tablist" aria-label="Sales" onKeyDown={onKey}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`sales-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`sales-panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            className="sales__tab"
            onClick={() => tab !== t.id && choose(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div id={`sales-panel-${tab}`} role="tabpanel" aria-labelledby={`sales-tab-${tab}`}>
        {tab === 'withdrawals' ? <WithdrawalsTab webinars={webinars} /> : <TransactionsTab webinars={webinars} />}
      </div>

      <SalesTestControls />
    </div>
  );
}