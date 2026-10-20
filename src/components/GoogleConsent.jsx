import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Loader2 } from 'lucide-react';
import googleIcon from '../assets/google-g.svg';
import { MOCK_GOOGLE_ACCOUNTS, PERMISSIONS } from '../data/calendarStore';
import { initials } from '../utils/initials';
import './GoogleConsent.css';

// How long "Connecting…" shows, standing in for the trip to Google and back
const ROUND_TRIP_MS = 900;

// ------------------------------------------------------------
// Stand-in for Google's own sign-in and permission screens, until the
// real Google connection is built. It can send back everything Google
// can, so the screens around it can be tried:
//   granted    every permission left ticked
//   partial    one unticked (Google lets people untick each one)
//   cancelled  Cancel, or Escape
//   error      "pretend Google fails", at the bottom
//
// The real thing is a redirect to Google and back. This is a pop-up in
// Google's colours, labelled as a stand-in so no one mistakes it.
//
// email: go straight to this account (reconnecting); otherwise they choose
// onResult({ outcome, email, granted }): granted is the permission ids ticked
// ------------------------------------------------------------
export default function GoogleConsent({ email = null, onResult }) {
  const ref = useRef(null);
  const timer = useRef(null);
  const [account, setAccount] = useState(email);
  const [ticked, setTicked] = useState(() => PERMISSIONS.map((p) => p.id));
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      clearTimeout(timer.current);
      if (dialog?.open) dialog.close();
    };
  }, []);

  const finish = (outcome) =>
    onResult({ outcome, email: account, granted: outcome === 'cancelled' || outcome === 'error' ? [] : ticked });

  // Continue (or a pretend failure): a moment of "Connecting…", then the result
  const after = (outcome) => {
    setWaiting(true);
    timer.current = setTimeout(() => finish(outcome), ROUND_TRIP_MS);
  };

  const allow = () => after(ticked.length === PERMISSIONS.length ? 'granted' : 'partial');
  const toggle = (id) => setTicked((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));

  return (
    <dialog
      ref={ref}
      className="gc"
      aria-labelledby="gc-title"
      onCancel={(e) => {
        e.preventDefault(); // Escape: closing it ourselves counts as Cancel
        e.stopPropagation(); // and only this: not a drawer it was opened from
        if (!waiting) finish('cancelled');
      }}
    >
      <div className="gc__bar">
        <img src={googleIcon} alt="" className="gc__g" />
        <span>Sign in with Google</span>
        <span className="gc__stand-in">Stand-in for Google</span>
      </div>

      {waiting ? (
        <div className="gc__waiting" role="status">
          <Loader2 size={28} className="gc__spin" aria-hidden="true" />
          Connecting…
        </div>
      ) : !account ? (
        <div className="gc__body">
          <h2 id="gc-title" className="gc__title">Choose an account</h2>
          <p className="gc__sub">to continue to OpenSlate</p>
          <ul className="gc__accounts">
            {MOCK_GOOGLE_ACCOUNTS.map((a, i) => (
              <li key={a.email}>
                <button type="button" className="gc__account" onClick={() => setAccount(a.email)} autoFocus={i === 0}>
                  <span className="gc__avatar" aria-hidden="true">{initials(a.name)}</span>
                  <span className="gc__who">
                    <span className="gc__name">{a.name}</span>
                    <span className="gc__email">{a.email}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="gc__actions">
            <button type="button" className="gc__text-btn" onClick={() => finish('cancelled')}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="gc__body">
          <span className="gc__chip">{account}</span>
          <h2 id="gc-title" className="gc__title">OpenSlate wants access to your Google Account</h2>
          <p className="gc__sub">Select what OpenSlate can access</p>
          <ul className="gc__perms">
            {PERMISSIONS.map((p) => (
              <li key={p.id}>
                <label className="gc__perm">
                  <CalendarDays size={20} className="gc__perm-icon" aria-hidden="true" />
                  <span className="gc__perm-text">{p.label}</span>
                  <input type="checkbox" checked={ticked.includes(p.id)} onChange={() => toggle(p.id)} />
                </label>
              </li>
            ))}
          </ul>
          <div className="gc__actions">
            <button type="button" className="gc__text-btn" onClick={() => finish('cancelled')}>
              Cancel
            </button>
            <button type="button" className="gc__continue" onClick={allow} autoFocus>
              Continue
            </button>
          </div>
        </div>
      )}

      {!waiting && (
        <p className="gc__test">
          Prototype only:{' '}
          <button type="button" onClick={() => after('error')}>
            pretend Google fails
          </button>
        </p>
      )}
    </dialog>
  );
}