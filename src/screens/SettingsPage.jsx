import { Check, ChevronDown, FlaskConical, Landmark, Lock, MessageCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import PaymentStep, { PAYMENT_STEPS, PayoutControlRows, currentStep, stepsOf, usePayout } from './PayoutSetup';
import { useInvoiceSettings } from './InvoiceSettings';
import { payoutState } from '../data/payouts';
import { loadInvoiceSettings } from '../data/invoiceSettings';
import WhatsAppSettings, { WhatsAppControlRows } from './WhatsAppSettings';
import { useWhatsApp } from '../components/WhatsAppTab';
import { hasNumber, needsContactNumber } from '../data/whatsappConnection';
import './OfferingsHome.css'; // the page frame and panels
import '../components/PrototypeControls.css';
import './SettingsPage.css';

// ------------------------------------------------------------
// Settings: the coach's account settings, opened from Settings at the foot
// of the sidebar (AppLayout.jsx), the account menu under it
// (AccountMenu.jsx), and Sales → Withdraw money when they can't withdraw yet. A menu on the left, the open page on the right:
//   Payment details (PayoutSetup.jsx), in three steps done in order:
//     Bank account       where their money goes
//     Address & invoice  what their invoices say; needs an address and PIN
//     Verify KYC         PAN and Aadhaar, or their business's documents:
//                        sent with the two above, and verified together
//   WhatsApp (WhatsAppSettings.jsx), in two pages:
//     Connection  the one number every webinar and 1:1 call sends from
//     Templates   the messages it sends, and Meta's review of each
// Other pages join PAGES.
//
//   Settings
//   ┌───────────────────┐ ┌ Payment details ─────────────────────────┐
//   │ ▣ Payment details │ │ Who you are and where we send your money │
//   │   │ Bank account ✓│ │ …                                        │
//   │   │ Address & inv.│ │                                          │
//   │   │ Verify KYC  🔒│ │                                          │
//   │ ◯ WhatsApp        │ │                                          │
//   │   │ Connection    │ │                                          │
//   │   │ Templates     │ │                                          │
//   └───────────────────┘ └──────────────────────────────────────────┘
//   (Prototype controls)
//
// On a phone the menu becomes one row of pills above the page.
//
// onPageChange(page): the page now open ('payments', 'whatsapp-connection', …),
//   so the app can hide the KYC banner on Payment details
// onWithdraw(): go to Sales → Withdraw money
// startOn: the page to open on: 'payments' (the first step not done yet),
//   one step ('payments-bank', 'payments-address', 'payments-kyc'),
//   'whatsapp' (its Connection), 'whatsapp-connection' or
//   'whatsapp-templates'; Payment details if left out
// startCreate: { product, moment } to open Templates on a new template for
//   that message (a reminder's "Create a new template")
//
// Until a number is connected, and again while it has no contact number,
// WhatsApp shows a red dot in the menu (on its Connection pill, on a
// phone). Until a number is connected, Templates is locked: greyed, with
// a lock, saying "Connect WhatsApp first" on hover or focus, and for a
// moment on a tap (phones have no hover). Asked to open Templates then,
// Connection opens instead; disconnecting while on Templates goes there too.
//
// Payment details' steps lock the same way (greyed, with a lock, the
// reason on hover, not clickable) until the one before is done, and get a
// tick once they're done.
// ------------------------------------------------------------

const PAGES = [
  { id: 'payments', label: 'Payment details', icon: Landmark, children: PAYMENT_STEPS },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: MessageCircle,
    children: [
      { id: 'whatsapp-connection', label: 'Connection', short: 'WhatsApp connection' },
      { id: 'whatsapp-templates', label: 'Templates', short: 'WhatsApp templates' },
    ],
  },
];

// Every page that can be open, in menu order
const OPENABLE = PAGES.flatMap((p) => (p.children ? p.children : [p]));
// Payment details on its own: its first step that isn't done
const firstPaymentStep = () => currentStep(payoutState(), loadInvoiceSettings());
const openable = (id) => {
  if (id === 'whatsapp') return 'whatsapp-connection';
  return OPENABLE.some((p) => p.id === id) ? id : firstPaymentStep();
};

export default function SettingsPage({ onWithdraw, onPageChange, startOn = 'payments', startCreate = null }) {
  const [chosen, setPage] = useState(() => openable(startOn));
  const payout = usePayout();
  const invoices = useInvoiceSettings();
  const steps = stepsOf(payout, invoices);
  const connection = useWhatsApp();
  const connected = hasNumber(connection);
  // WhatsApp's red dot: not connected, or connected without a contact number
  const attention = !connected ? 'not connected' : needsContactNumber(connection) ? 'contact number needed' : null;
  // Templates is locked until a number is connected: Connection instead
  // A Payment details step that's locked (the details were cleared while
  // it was open) gives way to the first step not done
  const lockedNow = Boolean(steps.locked[chosen]);
  const fallback = currentStep(payout, invoices);
  const page =
    !connected && chosen === 'whatsapp-templates' ? 'whatsapp-connection' : lockedNow ? fallback : chosen;
  // …and stays there, so the steps after it don't move the page on
  useEffect(() => {
    if (lockedNow) setPage(fallback);
  }, [lockedNow, fallback]);
  const onWhatsApp = page.startsWith('whatsapp');

  // Tell the app which page is open (the KYC banner hides on Payment details,
  // all three steps)
  const reported = onWhatsApp ? page : 'payments';
  useEffect(() => {
    onPageChange?.(reported);
  }, [reported, onPageChange]);

  return (
    <div className="oh settings">
      <h1 className="oh__title">Settings</h1>

      <div className="settings__layout">
        <SettingsMenu
          page={page}
          onPage={(id) => setPage(id === 'payments' ? firstPaymentStep() : id)}
          connected={connected}
          attention={attention}
          steps={steps}
        />

        <section className="oh__panel settings__panel" aria-label={OPENABLE.find((p) => p.id === page)?.short ?? 'Payment details'}>
          {onWhatsApp ? (
            <WhatsAppSettings
              view={page === 'whatsapp-templates' ? 'templates' : 'connection'}
              onView={(v) => setPage(`whatsapp-${v}`)}
              startCreate={startCreate}
            />
          ) : (
            <>
              <div className="oh__panel-head">
                <h2 className="oh__panel-title">{PAYMENT_STEPS.find((st) => st.id === page)?.label ?? 'Payment details'}</h2>
                <p className="oh__panel-sub">{STEP_SUBS[page]}</p>
              </div>
              <div className="settings__body settings__body--split">
                {/* key: each step opens fresh */}
                <PaymentStep key={page} step={page} onGo={setPage} onWithdraw={onWithdraw} />
                <PayoutHelp />
              </div>
            </>
          )}
        </section>
      </div>

      <SettingsTestControls section={onWhatsApp ? 'whatsapp' : 'payments'} />
    </div>
  );
}

// Under each step's title: what it's for, and where it sits
const STEP_SUBS = {
  'payments-bank': 'Step 1 of 3 · Where we send your money.',
  'payments-address': 'Step 2 of 3 · The name and address on your invoices.',
  'payments-kyc': 'Step 3 of 3 · Who you are. Your bank account and address are sent with it, and verified together.',
};

// ---------- The menu on the left ----------
// A page with pages of its own (WhatsApp) is a heading for them: a click
// on it opens its first page. Its icon lights up while one of them is open.
// connected: a WhatsApp number is connected. Until it is, Templates is
//   locked (LOCKED).
// attention: why WhatsApp needs a look, or null: 'not connected', or
//   'contact number needed'. While there's one, WhatsApp has a red dot,
//   and screen readers hear why.
// steps: Payment details' steps, done and locked (stepsOf, PayoutSetup.jsx)
const LOCKED = { 'whatsapp-templates': 'Connect WhatsApp first' };
const NEEDS_DOT = 'whatsapp'; // the section with the dot, and its first page on a phone

function SettingsMenu({ page, onPage, connected, attention, steps }) {
  const dot = (
    <span className="smenu__dot" aria-hidden="true" />
  );
  return (
    <nav className="smenu" aria-label="Settings">
      <ul className="smenu__list">
        {PAGES.map(({ id, label, icon: Icon, children }) => {
          const inside = children ? children.some((c) => c.id === page) : page === id;
          return (
            <li key={id} className={`smenu__group ${inside ? 'smenu__group--in' : ''}`}>
              <button
                type="button"
                className={`smenu__item ${!children && inside ? 'smenu__item--on' : ''}`}
                aria-current={!children && inside ? 'page' : undefined}
                // Payment details: its first step not done yet
                onClick={() => onPage(id === 'payments' ? 'payments' : children ? children[0].id : id)}
              >
                <Icon size={18} className="smenu__icon" aria-hidden="true" />
                <span className="smenu__label">
                  {label}
                  {attention && id === NEEDS_DOT && <span className="oh__sr-only">, {attention}</span>}
                </span>
                {attention && id === NEEDS_DOT && dot}
              </button>
              {children && (
                <ul className="smenu__sub">
                  {children.map((c, i) =>
                    id === 'payments' && steps.locked[c.id] && page !== c.id ? (
                      <li key={c.id}>
                        <LockedItem label={c.label} short={c.short} reason={steps.locked[c.id].reason} />
                      </li>
                    ) : id === 'payments' ? (
                      <li key={c.id}>
                        <StepItem
                          step={c}
                          on={page === c.id}
                          done={steps.done[c.id]}
                          lock={steps.locked[c.id]}
                          onOpen={() => onPage(c.id)}
                        />
                      </li>
                    ) : !connected && LOCKED[c.id] ? (
                      <li key={c.id}>
                        <LockedItem label={c.label} short={c.short} reason={LOCKED[c.id]} />
                      </li>
                    ) : (
                    <li key={c.id}>
                      <button
                        type="button"
                        className={`smenu__subitem ${page === c.id ? 'smenu__subitem--on' : ''}`}
                        aria-current={page === c.id ? 'page' : undefined}
                        onClick={() => onPage(c.id)}
                      >
                        <span className="smenu__label">{c.label}</span>
                        {/* On a phone the pills have no heading above them, so they say whose they are */}
                        <span className="smenu__short" aria-hidden="true">
                          {c.short}
                        </span>
                        {/* On a phone the section's heading is hidden: its dot moves to its first pill */}
                        {attention && id === NEEDS_DOT && i === 0 && (
                          <span className="smenu__dot smenu__dot--pill" aria-hidden="true" />
                        )}
                      </button>
                    </li>
                    ),
                  )}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// One of Payment details' steps that can be opened (a locked one is a
// LockedItem). Done: a tick. Still locked while open (only if opened from
// elsewhere): the lock.
function StepItem({ step, on, done, lock, onOpen }) {
  return (
    <button
      type="button"
      className={`smenu__subitem smenu__subitem--step ${on ? 'smenu__subitem--on' : ''}`}
      aria-current={on ? 'page' : undefined}
      aria-label={done ? `${step.label}. Done` : undefined}
      onClick={onOpen}
    >
      <span className="smenu__label">{step.label}</span>
      <span className="smenu__short" aria-hidden="true">
        {step.short}
      </span>
      {lock ? (
        <Lock size={14} className="smenu__lock" aria-hidden="true" />
      ) : done ? (
        <Check size={14} className="smenu__tick" aria-hidden="true" />
      ) : null}
    </button>
  );
}

// A page that can't open yet: greyed, with a lock. Hover or focus says why
// (the app's tooltip); a tap shows it for a moment too, since phones have
// no hover. It stays focusable, so keyboards and screen readers hear why.
function LockedItem({ label, short, reason }) {
  const [shown, setShown] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const show = () => {
    setShown(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setShown(false), 2500);
  };

  return (
    <button
      type="button"
      className={`smenu__subitem smenu__subitem--locked ${shown ? 'smenu__subitem--tip' : ''}`}
      aria-disabled="true"
      aria-label={`${label}. ${reason}`}
      data-tip={reason}
      data-tip-align="start"
      onClick={show}
    >
      <span className="smenu__label">{label}</span>
      <span className="smenu__short" aria-hidden="true">
        {short}
      </span>
      <Lock size={14} className="smenu__lock" aria-hidden="true" />
    </button>
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
        Three steps: your bank account, your address, then your KYC documents. They’re sent to our payment partner
        together when you submit your KYC, and verified at once. Your documents are used only for this.
      </p>
      <p>Photos or PDFs, up to 5 MB each. Make sure every word on the card can be read.</p>
    </aside>
  );
}

// ---------- Prototype controls: not part of the product ----------
const OPEN_KEY = 'pagebuilder:settings-controls-open';

// section: the open tab, whose controls show
function SettingsTestControls({ section }) {
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
          {section === 'whatsapp' ? <WhatsAppControlRows /> : <PayoutControlRows />}
        </div>
      )}
    </section>
  );
}