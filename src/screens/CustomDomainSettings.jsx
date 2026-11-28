import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, Copy, ExternalLink, Globe, Loader2 } from 'lucide-react';
import { copyText } from '../utils/copyText';
import {
  CNAME_TARGET,
  DEFAULT_DOMAIN,
  ERRORS,
  FOUND_VALUE,
  STATUS_LABELS,
  checkDomain,
  connectDomain,
  domainDemo,
  recordName,
  removeDomain,
  setNextCheck,
  useCustomDomain,
  useNextCheck,
  verifyDomain,
} from '../data/customDomain';
import './CustomDomainSettings.css';

// ------------------------------------------------------------
// Settings → Custom domain: the coach puts the platform on their own
// address (academy.harishneel.com instead of app.openslate.ai).
// One domain per coach, a subdomain only. All mocked (data/customDomain.js).
//
// Not connected:
//   Custom domain                                      [● Not connected]
//   Use your own web address for your pages and dashboard.
//   ──────────────────────────────────────────────────────────────────
//   Your domain
//   [ academy.yourdomain.com              ]  [Connect]
//   Use a subdomain. Until it's live, links stay on app.openslate.ai.
//
// Connecting (Checking DNS, Issuing SSL, or a problem). While they're
// adding the record, How to add it sits on the right: GoDaddy, Cloudflare,
// Namecheap, Hostinger, Other, one click showing its three steps.
//   🌐 academy.harishneel.com
//   ● DNS record ──── ○ SSL ──── ○ Live
//   [⚠ We can't find the record yet · Check it's added exactly …  ]
//   Add this record where you bought your domain
//   │ Type   │ Name     │ Value                 │
//   │ CNAME  │ academy ⧉│ domains.openslate.ai ⧉│
//   [Verify now]  Checked 2 min ago · DNS changes can take up to 24 hours
//
// Live:
//   ✓ academy.harishneel.com is live                            [Open ↗]
//   Old links keep working and send people here.
//
// No Remove button. Only "This domain is used by another account" offers
// Use another domain, which clears it so they can enter a new one.
// ------------------------------------------------------------

export default function CustomDomainSettings() {
  const state = useCustomDomain();
  // How to add it, on the right: only while they're adding the record
  const showGuides =
    state.status === 'checking' || (state.status === 'error' && DNS_ERRORS.includes(state.error) && state.error !== 'taken');

  return (
    <>
      <div className="oh__panel-head oh__panel-head--split">
        <div>
          <h2 className="oh__panel-title">Custom domain</h2>
          <p className="oh__panel-sub">Use your own web address for your pages and dashboard.</p>
        </div>
        <StatusPill state={state} />
      </div>

      <div className={`cdom ${showGuides ? 'cdom--split' : ''}`}>
        {state.status === 'none' ? (
          <ConnectForm />
        ) : state.status === 'live' ? (
          <LiveCard domain={state.domain} />
        ) : (
          <Setup state={state} />
        )}
        {showGuides && <Guides name={recordName(state.domain)} />}
      </div>
    </>
  );
}

// ---------- The status, top right ----------
function StatusPill({ state }) {
  const tone =
    state.status === 'live' ? 'live' : state.status === 'error' ? 'bad' : state.status === 'none' ? 'off' : 'wait';
  return <span className={`cdom-pill cdom-pill--${tone}`}>{STATUS_LABELS[state.status]}</span>;
}

// ---------- Not connected: one box and Connect ----------
function ConnectForm() {
  const [text, setText] = useState('');
  const [error, setError] = useState(null);

  const submit = (e) => {
    e.preventDefault();
    const { domain, error: problem } = checkDomain(text);
    if (problem) setError(problem);
    else connectDomain(domain);
  };

  return (
    <form className="cdom-connect" onSubmit={submit} noValidate>
      <label className="po-field__label" htmlFor="cdom-domain">
        Your domain
      </label>
      <div className="cdom-connect__row">
        <input
          id="cdom-domain"
          className={`po-input ${error ? 'po-input--error' : ''}`}
          type="text"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck="false"
          placeholder="academy.yourdomain.com"
          value={text}
          aria-invalid={Boolean(error)}
          aria-describedby="cdom-domain-note"
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
        />
        <button type="submit" className="cdom-btn cdom-btn--primary">
          Connect
        </button>
      </div>
      <p id="cdom-domain-note" className={`cdom-note ${error ? 'cdom-note--error' : ''}`} role={error ? 'alert' : undefined}>
        {error ?? `Use a subdomain. Until it’s live, links stay on ${DEFAULT_DOMAIN}.`}
      </p>
    </form>
  );
}

// ---------- Connecting: the record to add, and Verify now ----------
const DNS_ERRORS = ['not-found', 'wrong-target', 'proxied', 'taken'];

function Setup({ state }) {
  const { domain, status, error } = state;
  const problem = error ? ERRORS[error] : null;
  // Past DNS: the record's found, so it no longer needs adding
  const pastDns = status === 'ssl' || error === 'ssl-failed';
  const [checking, verify] = useVerify();

  return (
    <div className="cdom-setup">
      <div className="cdom-domain">
        <Globe size={18} className="cdom-domain__icon" aria-hidden="true" />
        <span className="cdom-domain__name">{domain}</span>
      </div>

      <Steps status={status} error={error} />

      {problem && (
        <div className="cdom-problem" role="alert">
          <AlertCircle size={18} className="cdom-problem__icon" aria-hidden="true" />
          <div className="cdom-problem__text">
            <p className="cdom-problem__title">{problem.title}</p>
            <p>
              {error === 'wrong-target' ? `It points to ${FOUND_VALUE}. ` : ''}
              {problem.fix}
            </p>
          </div>
          {problem.action === 'remove' && (
            <button type="button" className="cdom-btn cdom-btn--quiet" onClick={removeDomain}>
              Use another domain
            </button>
          )}
        </div>
      )}

      {pastDns ? (
        !problem && (
          <div className="cdom-wait">
            <Loader2 size={18} className="cdom-spin" aria-hidden="true" />
            <p>Record found. Securing your domain, usually within a few minutes.</p>
          </div>
        )
      ) : (
        <Record domain={domain} />
      )}

      {error !== 'taken' && (
        <div className="cdom-verify">
          <button type="button" className="cdom-btn cdom-btn--primary" onClick={verify} disabled={checking}>
            {checking ? (
              <>
                <Loader2 size={16} className="cdom-spin" aria-hidden="true" /> Checking…
              </>
            ) : (
              'Verify now'
            )}
          </button>
          <p className="cdom-note">
            <LastChecked at={state.checkedAt} />
            {!pastDns && ' DNS changes can take up to 24 hours.'}
          </p>
        </div>
      )}
    </div>
  );
}

// Verify now, with a moment of "Checking…" as the real check would take
function useVerify() {
  const [checking, setChecking] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const verify = () => {
    setChecking(true);
    timer.current = setTimeout(() => {
      verifyDomain();
      setChecking(false);
    }, 1200);
  };
  return [checking, verify];
}

function LastChecked({ at }) {
  if (!at) return 'We check automatically.';
  const mins = Math.floor((Date.now() - at) / 60000);
  return mins < 1 ? 'Checked just now.' : `Checked ${mins} min ago.`;
}

// DNS record ── SSL ── Live: where they are
function Steps({ status, error }) {
  const dnsBad = DNS_ERRORS.includes(error);
  const sslBad = error === 'ssl-failed';
  const dns = dnsBad ? 'bad' : status === 'checking' ? 'now' : 'done';
  const ssl = sslBad ? 'bad' : status === 'ssl' ? 'now' : 'todo';
  const steps = [
    ['DNS record', dns],
    ['SSL', dns === 'done' ? ssl : 'todo'],
    ['Live', 'todo'],
  ];
  return (
    <ol className="cdom-steps" aria-label="Progress">
      {steps.map(([label, s]) => (
        <li key={label} className={`cdom-step cdom-step--${s}`}>
          <span className="cdom-step__dot" aria-hidden="true">
            {s === 'done' ? <Check size={12} strokeWidth={3} /> : s === 'bad' ? '!' : null}
          </span>
          <span>
            {label}
            <span className="oh__sr-only">
              {s === 'done' ? ', done' : s === 'now' ? ', in progress' : s === 'bad' ? ', needs attention' : ''}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

// ---------- The CNAME record, with copy buttons ----------
function Record({ domain }) {
  const rows = [
    ['Type', 'CNAME', false],
    ['Name', recordName(domain), true],
    ['Value', CNAME_TARGET, true],
  ];
  return (
    <div className="cdom-record">
      <p className="cdom-record__title">Add this record where you bought your domain</p>
      <dl className="cdom-record__table">
        {rows.map(([label, value, copy]) => (
          <div key={label} className="cdom-record__row">
            <dt>{label}</dt>
            <dd>
              <code>{value}</code>
              {copy && <CopyButton text={value} label={label} />}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function CopyButton({ text, label }) {
  const [done, setDone] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      className="cdom-copy"
      aria-label={done ? `${label} copied` : `Copy ${label.toLowerCase()}`}
      onClick={async () => {
        if (!(await copyText(text))) return;
        setDone(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      <span>{done ? 'Copied' : 'Copy'}</span>
    </button>
  );
}

// ---------- Short guides for the popular providers ----------
const GUIDES = [
  {
    name: 'GoDaddy',
    steps: (n) => [
      'My Products → your domain → DNS.',
      `Add New Record. Type CNAME, Name ${n}, Value ${CNAME_TARGET}.`,
      'Save.',
    ],
  },
  {
    name: 'Cloudflare',
    steps: (n) => [
      'Your domain → DNS → Records → Add record.',
      `Type CNAME, Name ${n}, Target ${CNAME_TARGET}.`,
      'Turn Proxy status off (grey cloud, DNS only), then Save.',
    ],
  },
  {
    name: 'Namecheap',
    steps: (n) => [
      'Domain List → Manage → Advanced DNS.',
      `Add New Record → CNAME Record. Host ${n}, Target ${CNAME_TARGET}.`,
      'Click the tick to save.',
    ],
  },
  {
    name: 'Hostinger',
    steps: (n) => [
      'Domains → Manage → DNS / Nameservers.',
      `Type CNAME, Name ${n}, Target ${CNAME_TARGET}.`,
      'Add Record.',
    ],
  },
  {
    name: 'Other',
    steps: () => [
      'Open your domain’s DNS settings.',
      'Add a CNAME record with the Name and Value above.',
      'Save, then come back and Verify.',
    ],
  },
];

// On the right, like Payment details' help: one button per provider,
// its steps under them. GoDaddy's open first.
function Guides({ name }) {
  const [open, setOpen] = useState(GUIDES[0].name);
  const guide = GUIDES.find((g) => g.name === open);
  return (
    <aside className="settings__help cdom-guides" aria-labelledby="cdom-guides-title">
      <h3 className="settings__help-title" id="cdom-guides-title">
        How to add it
      </h3>
      <div className="cdom-guides__picks">
        {GUIDES.map((g) => (
          <button
            key={g.name}
            type="button"
            className="cdom-guides__pick"
            aria-pressed={g.name === open}
            onClick={() => setOpen(g.name)}
          >
            {g.name}
          </button>
        ))}
      </div>
      <ol className="cdom-guides__steps" aria-live="polite">
        {guide.steps(name).map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </aside>
  );
}

// ---------- Live ----------
function LiveCard({ domain }) {
  return (
    <div className="cdom-live">
      <span className="cdom-live__icon" aria-hidden="true">
        <Check size={18} strokeWidth={3} />
      </span>
      <div className="cdom-live__text">
        <p className="cdom-live__title">{domain} is live</p>
        <p className="cdom-note">Old links keep working and send people here.</p>
      </div>
      <div className="cdom-live__actions">
        <a className="cdom-btn cdom-btn--quiet" href={`https://${domain}`} target="_blank" rel="noreferrer">
          Open <ExternalLink size={14} aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}

// ---------- Prototype controls: not part of the product ----------
export function CustomDomainControlRows() {
  const state = useCustomDomain();
  const next = useNextCheck();
  const on = (status, error = null) => state.status === status && state.error === error;
  return (
    <>
      <div className="proto__row">
        <span className="proto__label">Status</span>
        <div className="proto__controls">
          {['none', 'checking', 'ssl', 'live'].map((s) => (
            <button
              key={s}
              type="button"
              className="proto__btn"
              aria-pressed={on(s)}
              onClick={() => domainDemo.setStatus(s)}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>
      <div className="proto__row">
        <span className="proto__label">Show error</span>
        <div className="proto__controls">
          {Object.entries(ERRORS).map(([id, e]) => (
            <button
              key={id}
              type="button"
              className="proto__btn"
              aria-pressed={on('error', id)}
              onClick={() => domainDemo.setStatus('error', id)}
            >
              {e.label}
            </button>
          ))}
        </div>
      </div>
      <div className="proto__row">
        <span className="proto__label">Next Verify</span>
        <div className="proto__controls">
          {['pass', 'not-found', 'wrong-target', 'proxied', 'ssl-failed'].map((id) => (
            <button
              key={id}
              type="button"
              className="proto__btn"
              aria-pressed={next === id}
              onClick={() => setNextCheck(id)}
            >
              {id === 'pass' ? 'Moves on' : ERRORS[id].label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
