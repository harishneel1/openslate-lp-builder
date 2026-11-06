import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Check, CircleCheck, Landmark, Loader2 } from 'lucide-react';
import {
  CHECK_MS,
  IFSC_EXAMPLE,
  OUTCOMES,
  accountProblem,
  cancelBankChange,
  cleanAccount,
  cleanIfsc,
  cleanPan,
  finishCheckNow,
  holderProblem,
  ifscProblem,
  lookupIfsc,
  maskAccount,
  maskPan,
  onPayoutsChange,
  panNameOf,
  panProblem,
  payoutState,
  setNextOutcome,
  startWithNoBank,
  submitBankChange,
  submitPayout,
  resetToDemoBank,
} from '../data/payouts';

// ------------------------------------------------------------
// Settings → Bank account: the bank account a coach's money is withdrawn to
// (data/payouts.js). One section, four states:
//
//   none       the setup, straight away (nothing to look at before it):
//              1. "What's your PAN?" (we show who it's registered to)
//              2. "Which bank account should we pay into?": IFSC (the bank
//                 and branch appear as it's typed), account number twice,
//                 the name on the account (the PAN's name to start with)
//              → Verify account
//   checking   "Checking your bank account": we're sending ₹1 to it; they
//              can leave the page
//   needs-fix  amber: what's wrong, in words, and Fix it, which opens the
//              setup on the field to fix, with everything they typed
//   verified   their details, masked, with a green Verified pill. Right
//              after a check passes: "HDFC Bank ••4521 is verified" and a
//              Withdraw money button back to Sales.
//
// Withdraw money's card (WithdrawalsTab.jsx) sends coaches here for all
// of these, so this is the one place a bank account is added or fixed.
//
// Changing it (verified only): Change bank account opens the bank step
// alone ("Which account should we pay into instead?"); the PAN stays.
// The new account is checked while the old one keeps working:
//   checking   a blue line: "Checking SBI ••5894. Withdrawals keep going
//              to HDFC Bank ••4521 until it's verified." and Cancel change
//   needs-fix  amber: what's wrong, Fix it and Cancel change
//   passed     green: "SBI ••5894 is verified. Withdrawals now go to it."
// The withdraw pop-up's Change link comes here too.
//
// onWithdraw(): go to Sales → Withdraw money
// ------------------------------------------------------------

// The payout account now, re-read when it changes and every second while
// a check is running (the account's or a change's), so it ends on screen
// as soon as it does
export function usePayout() {
  const [, setTick] = useState(0);
  useEffect(() => onPayoutsChange(() => setTick((n) => n + 1)), []);
  const state = payoutState(Date.now());
  const checking = state.status === 'checking' || state.pending?.status === 'checking';
  useEffect(() => {
    if (!checking) return undefined;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [checking]);
  return state;
}

// 'HARISH NEEL' → 'Harish Neel'
const titleCase = (name) => String(name ?? '').toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

export default function PayoutsSection({ onWithdraw }) {
  const payout = usePayout();
  // What the setup is open for: null, 'fix' (the account's check failed),
  // 'change' (a new account), 'fix-change' (the new account's check failed)
  const [editing, setEditing] = useState(null);
  // Checks that end while they're here get a moment of their own
  const [sawChecking, setSawChecking] = useState(payout.status === 'checking');
  const [sawChange, setSawChange] = useState(payout.pending?.status === 'checking');
  const pendingStatus = payout.pending?.status ?? null;
  useEffect(() => {
    if (payout.status === 'checking') setSawChecking(true);
  }, [payout.status]);
  useEffect(() => {
    if (pendingStatus === 'checking') setSawChange(true);
  }, [pendingStatus]);
  useEffect(() => {
    if (editing === 'fix' && payout.status !== 'needs-fix') setEditing(null);
    if (editing === 'fix-change' && pendingStatus !== 'needs-fix') setEditing(null);
  }, [editing, payout.status, pendingStatus]);

  if (payout.status === 'none' || editing === 'fix') {
    return (
      <Setup
        start={editing === 'fix' ? payout : null}
        problem={editing === 'fix' ? payout.problem : null}
        onCancel={editing === 'fix' ? () => setEditing(null) : null}
        onSubmit={(details) => {
          submitPayout(details);
          setEditing(null);
        }}
      />
    );
  }

  if (editing === 'change' || editing === 'fix-change') {
    const fixing = editing === 'fix-change';
    return (
      <Setup
        change
        start={{ pan: payout.pan, bank: fixing ? payout.pending.bank : { holder: payout.bank.holder } }}
        problem={fixing ? payout.pending.problem : null}
        current={payout.bank}
        onCancel={() => setEditing(null)}
        onSubmit={({ bank }) => {
          submitBankChange(bank);
          setSawChange(true);
          setEditing(null);
        }}
      />
    );
  }

  if (payout.status === 'checking') return <Checking payout={payout} />;

  if (payout.status === 'needs-fix') {
    return (
      <div className="po">
        <div className="po-alert po-alert--fix" role="alert">
          <AlertTriangle size={18} aria-hidden="true" />
          <div>
            <p className="po-alert__title">Your bank account needs a fix</p>
            <p>{payout.problem.message}</p>
          </div>
        </div>
        <Details payout={payout} status={<span className="po-pill po-pill--refund">Needs a fix</span>} />
        <div className="po-actions">
          <button type="button" className="oh__add" onClick={() => setEditing('fix')}>
            Fix it
          </button>
        </div>
      </div>
    );
  }

  // Verified, maybe with a change being checked or needing a fix
  const pending = payout.pending;
  const current = `${payout.bank.bankName} ${maskAccount(payout.bank.account)}`;
  const justChanged = sawChange && !pending && payout.changedAt;
  return (
    <div className="po">
      {justChanged ? (
        <div className="po-alert po-alert--done" role="status">
          <CircleCheck size={18} aria-hidden="true" />
          <div className="po-alert__grow">
            <p className="po-alert__title">{current} is verified</p>
            <p>Withdrawals now go to it.</p>
          </div>
        </div>
      ) : (
        sawChecking &&
        !pending && (
          <div className="po-alert po-alert--done" role="status">
            <CircleCheck size={18} aria-hidden="true" />
            <div className="po-alert__grow">
              <p className="po-alert__title">{current} is verified</p>
              <p>Your earnings can now be withdrawn to it.</p>
            </div>
            {onWithdraw && (
              <button type="button" className="oh__add" onClick={onWithdraw}>
                Withdraw money
              </button>
            )}
          </div>
        )
      )}

      {pending?.status === 'checking' && (
        <div className="po-alert po-alert--checking" role="status">
          <Loader2 size={18} aria-hidden="true" className="po-spin" />
          <div className="po-alert__grow">
            <p className="po-alert__title">
              Checking {pending.bank.bankName} {maskAccount(pending.bank.account)}
            </p>
            <p>Withdrawals keep going to {current} until it’s verified.</p>
          </div>
          <button type="button" className="po-link" onClick={() => cancelBankChange()}>
            Cancel change
          </button>
        </div>
      )}

      {pending?.status === 'needs-fix' && (
        <div className="po-alert po-alert--fix" role="alert">
          <AlertTriangle size={18} aria-hidden="true" />
          <div className="po-alert__grow">
            <p className="po-alert__title">
              Your new account, {pending.bank.bankName} {maskAccount(pending.bank.account)}, needs a fix
            </p>
            <p>{pending.problem.message}</p>
            <p className="po-alert__more">Withdrawals still go to {current}.</p>
            <div className="po-alert__actions">
              <button type="button" className="oh__add" onClick={() => setEditing('fix-change')}>
                Fix it
              </button>
              <button type="button" className="po-link" onClick={() => cancelBankChange()}>
                Cancel change
              </button>
            </div>
          </div>
        </div>
      )}

      <Details
        payout={payout}
        status={<span className="po-pill po-pill--done">Verified</span>}
        action={
          !pending && (
            <button type="button" className="oh__edit" onClick={() => setEditing('change')}>
              Change bank account
            </button>
          )
        }
      />
    </div>
  );
}

// ---------- Their details, masked ----------

const fullDate = (ms) =>
  new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function Details({ payout, status, action = null }) {
  const { bank } = payout;
  return (
    <div className="po-card">
      <div className="po-card__head">
        <span className="po-tile" aria-hidden="true">
          <Landmark size={20} />
        </span>
        <div className="po-card__who">
          <p className="po-card__bank">
            {bank.bankName} {maskAccount(bank.account)}
          </p>
          <p className="po-card__branch">{bank.branch}</p>
        </div>
        {status}
      </div>
      <dl className="po-dl">
        <div>
          <dt>Account holder</dt>
          <dd>{bank.holder}</dd>
        </div>
        <div>
          <dt>IFSC</dt>
          <dd>{bank.ifsc}</dd>
        </div>
        <div>
          <dt>PAN</dt>
          <dd>
            {maskPan(payout.pan)} · {titleCase(payout.panName)}
          </dd>
        </div>
        {payout.verifiedAt && (
          <div>
            <dt>Verified on</dt>
            <dd>{fullDate(payout.verifiedAt)}</dd>
          </div>
        )}
      </dl>
      {action && <div className="po-card__foot">{action}</div>}
    </div>
  );
}

// ---------- While it's being checked ----------

function Checking({ payout }) {
  return (
    <div className="po">
      <div className="po-checking" role="status">
        <span className="po-tile" aria-hidden="true">
          <Loader2 size={20} className="po-spin" />
        </span>
        <div>
          <p className="po-checking__title">Checking your bank account</p>
          <p className="po-checking__text">
            We’re sending ₹1 to {payout.bank.bankName} {maskAccount(payout.bank.account)} to make sure it’s yours. This
            usually takes a few minutes, and you can leave this page.
          </p>
        </div>
      </div>
      <Details payout={payout} status={<span className="po-pill po-pill--processing">Checking</span>} />
    </div>
  );
}

// ---------- Adding, fixing or changing the account ----------
// Two steps (PAN, bank); a change is the bank step alone, the PAN staying.
// start: what they gave before (fixing) or the PAN and name (changing);
// problem: what to fix ({ step, field, message }), shown on that field;
// current: the account being replaced, when changing.
// onSubmit({ pan, panName, bank })
function Setup({ start, problem, onCancel, onSubmit, change = false, current = null }) {
  const [step, setStep] = useState(change || problem?.step === 'bank' ? 'bank' : 'pan');
  const [pan, setPan] = useState(start?.pan ?? '');
  const [ifsc, setIfsc] = useState(start?.bank?.ifsc ?? '');
  const [account, setAccount] = useState(start?.bank?.account ?? '');
  const [again, setAgain] = useState(start?.bank?.account ?? '');
  const [holder, setHolder] = useState(start?.bank?.holder ?? '');
  const [tried, setTried] = useState(Boolean(problem));
  // A problem from the check stays on its field until that field changes
  const [checkProblem, setCheckProblem] = useState(problem);
  const first = useRef(null);

  const panName = panNameOf(pan);

  // The keyboard goes to the step's first field, or to the one to fix
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const fix = checkProblem?.step === step && document.getElementById(`po-${checkProblem.field}`);
      (fix || first.current)?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const errors =
    step === 'pan'
      ? { pan: panProblem(pan) }
      : {
          ifsc: ifscProblem(ifsc),
          account: accountProblem(account, again) ?? (checkProblem?.field === 'account' ? checkProblem.message : null),
          holder: holderProblem(holder) ?? (checkProblem?.field === 'holder' ? checkProblem.message : null),
        };
  const hasError = Object.values(errors).some(Boolean);
  const show = (field) => (tried ? errors[field] : null);

  const next = () => {
    setTried(true);
    if (hasError) return;
    if (step === 'pan') {
      if (!holder) setHolder(titleCase(panName));
      setTried(false);
      setStep('bank');
      return;
    }
    onSubmit({ pan, panName, bank: { account, ifsc, holder: holder.trim() } });
  };

  const bankInfo = lookupIfsc(ifsc);

  return (
    <div className="po po-setup">
      <div className="po-setup__top">
        {change ? (
          <button type="button" className="po-back" onClick={onCancel}>
            <ArrowLeft size={16} aria-hidden="true" /> Cancel
          </button>
        ) : step === 'bank' ? (
          <button
            type="button"
            className="po-back"
            onClick={() => {
              setTried(false);
              setStep('pan');
            }}
          >
            <ArrowLeft size={16} aria-hidden="true" /> Back
          </button>
        ) : (
          onCancel && (
            <button type="button" className="po-back" onClick={onCancel}>
              <ArrowLeft size={16} aria-hidden="true" /> Cancel
            </button>
          )
        )}
        {!change && <p className="po-setup__step">Step {step === 'pan' ? 1 : 2} of 2</p>}
      </div>

      {step === 'pan' ? (
        <>
          <h3 className="po-setup__title">What’s your PAN?</h3>
          <p className="po-setup__help">We need it to pay you, and to deduct and file TDS in your name.</p>

          <div className="po-field">
            <label className="po-field__label" htmlFor="po-pan">
              PAN
            </label>
            <input
              ref={first}
              id="po-pan"
              className={`po-input po-input--code ${show('pan') ? 'po-input--error' : ''}`}
              value={pan}
              placeholder="ABCPE1234F"
              autoComplete="off"
              aria-invalid={Boolean(show('pan')) || undefined}
              aria-describedby="po-pan-note"
              onChange={(e) => setPan(cleanPan(e.target.value))}
              onKeyDown={(e) => e.key === 'Enter' && next()}
            />
            <p className="po-field__note" id="po-pan-note" role={show('pan') ? 'alert' : undefined}>
              {show('pan') ? (
                <span className="po-field__error">{show('pan')}</span>
              ) : panName ? (
                <span className="po-field__ok">
                  <Check size={14} aria-hidden="true" /> Registered to {panName}
                </span>
              ) : (
                'It’s on your PAN card.'
              )}
            </p>
          </div>
        </>
      ) : (
        <>
          <h3 className="po-setup__title">
            {change ? 'Which account should we pay into instead?' : 'Which bank account should we pay into?'}
          </h3>
          <p className="po-setup__help">
            {change && current
              ? `It must be in your own name. Withdrawals keep going to ${current.bankName} ${maskAccount(current.account)} until the new one is checked.`
              : 'It must be in your own name.'}
          </p>

          <div className="po-field">
            <label className="po-field__label" htmlFor="po-ifsc">
              IFSC
            </label>
            <input
              ref={first}
              id="po-ifsc"
              className={`po-input po-input--code ${show('ifsc') ? 'po-input--error' : ''}`}
              value={ifsc}
              placeholder={IFSC_EXAMPLE}
              autoComplete="off"
              aria-invalid={Boolean(show('ifsc')) || undefined}
              aria-describedby="po-ifsc-note"
              onChange={(e) => setIfsc(cleanIfsc(e.target.value))}
            />
            <p className="po-field__note" id="po-ifsc-note">
              {bankInfo ? (
                <span className="po-field__ok">
                  <Check size={14} aria-hidden="true" /> {bankInfo.bankName}, {bankInfo.branch}
                </span>
              ) : show('ifsc') ? (
                <span className="po-field__error">{show('ifsc')}</span>
              ) : (
                'On your cheque book and in your bank’s app.'
              )}
            </p>
          </div>

          <div className="po-field-row">
            <div className="po-field">
              <label className="po-field__label" htmlFor="po-account">
                Account number
              </label>
              <input
                id="po-account"
                className={`po-input ${show('account') ? 'po-input--error' : ''}`}
                value={account}
                inputMode="numeric"
                autoComplete="off"
                aria-invalid={Boolean(show('account')) || undefined}
                aria-describedby="po-account-note"
                onChange={(e) => {
                  setAccount(cleanAccount(e.target.value));
                  if (checkProblem?.field === 'account') setCheckProblem(null);
                }}
              />
            </div>
            <div className="po-field">
              <label className="po-field__label" htmlFor="po-again">
                Account number again
              </label>
              <input
                id="po-again"
                className={`po-input ${show('account') ? 'po-input--error' : ''}`}
                value={again}
                inputMode="numeric"
                autoComplete="off"
                onPaste={(e) => e.preventDefault()}
                onChange={(e) => setAgain(cleanAccount(e.target.value))}
              />
            </div>
          </div>
          <p className="po-field__note po-field__note--row" id="po-account-note">
            {show('account') && <span className="po-field__error">{show('account')}</span>}
          </p>

          <div className="po-field">
            <label className="po-field__label" htmlFor="po-holder">
              Name on the account
            </label>
            <input
              id="po-holder"
              className={`po-input ${show('holder') ? 'po-input--error' : ''}`}
              value={holder}
              autoComplete="name"
              aria-invalid={Boolean(show('holder')) || undefined}
              aria-describedby="po-holder-note"
              onChange={(e) => {
                setHolder(e.target.value);
                if (checkProblem?.field === 'holder') setCheckProblem(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && next()}
            />
            <p className="po-field__note" id="po-holder-note">
              {show('holder') ? <span className="po-field__error">{show('holder')}</span> : 'As your bank has it.'}
            </p>
          </div>
        </>
      )}

      <div className="po-actions">
        <button type="button" className="oh__add" onClick={next}>
          {step === 'pan' ? 'Continue' : change ? 'Verify new account' : 'Verify account'}
        </button>
      </div>
      {step === 'bank' && (
        <p className="po-setup__fine">We’ll send ₹1 to this account to check it’s yours.</p>
      )}
    </div>
  );
}

// ---------- Prototype controls (not part of the product) ----------
// Rows for a Prototype controls panel (PrototypeControls.css): start with
// no bank or the demo's verified one, how the next check ends, and
// ending a check now. Used on Settings and under Sales.
export function PayoutControlRows() {
  const payout = usePayout();
  return (
    <>
      <div className="proto__row">
        <span className="proto__label">Bank account</span>
        <div className="proto__controls">
          <button type="button" className="proto__btn" aria-pressed={payout.status === 'none'} onClick={startWithNoBank}>
            No bank yet
          </button>
          <button type="button" className="proto__btn" onClick={resetToDemoBank}>
            Demo bank, verified
          </button>
          {payout.status === 'checking' && (
            <button type="button" className="proto__btn" onClick={() => finishCheckNow()}>
              Finish the check now
            </button>
          )}
        </div>
      </div>
      <div className="proto__row">
        <span className="proto__label">Next check ends</span>
        <div className="proto__controls">
          {OUTCOMES.map((o) => (
            <button
              key={o.id}
              type="button"
              className="proto__btn"
              aria-pressed={(payout.nextOutcome ?? 'approve') === o.id}
              onClick={() => setNextOutcome(o.id)}
            >
              {o.label}
            </button>
          ))}
          <p className="proto__note">
            A check takes {CHECK_MS / 1000} seconds in the prototype. After a failed one, the next goes through unless you
            pick again.
          </p>
        </div>
      </div>
    </>
  );
}