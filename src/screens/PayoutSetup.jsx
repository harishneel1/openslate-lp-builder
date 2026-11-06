import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Check, CircleCheck, Landmark, Loader2 } from 'lucide-react';
import {
  BANK_OUTCOMES,
  CHECK_MS,
  IFSC_EXAMPLE,
  KYC_CHECK_MS,
  KYC_OUTCOMES,
  accountProblem,
  cancelBankChange,
  cleanAccount,
  cleanIfsc,
  finishChecksNow,
  holderProblem,
  ifscProblem,
  lookupIfsc,
  maskAccount,
  onPayoutsChange,
  payeeOf,
  payoutState,
  resetToDemo,
  setNextOutcome,
  startFresh,
  submitBank,
  submitBankChange,
  submitKyc,
} from '../data/payouts';
import { IdentityCard, IdentitySetup, titleCase } from './IdentitySetup';

// ------------------------------------------------------------
// Settings → Payment details: who the coach is and where their money goes
// (data/payouts.js). Two parts on the page, in the order they're done:
//
//   Identity   IdentityCard (IdentitySetup.jsx): PAN and Aadhaar, with a
//              photo or PDF of each, checked against government records
//   Bank       BankCard: the account withdrawals go to, checked by
//              sending it ₹1. It must be in the payee's name (the coach,
//              or their business; a proprietorship's can be either), so
//              it can be added once identity is sent; before that it says so.
//
// Withdrawing needs both verified. When the last one passes while they're
// here: "You're ready to withdraw" and a Withdraw money button back to
// Sales.
//
// Bank card, by status:
//   none       what it's for, and Add bank account
//   checking   "Checking your bank account": we're sending ₹1 to it
//   needs-fix  amber: what's wrong, and Fix it, which opens the setup on
//              the field to fix, with everything they typed
//   verified   their details, masked, with a green Verified pill, and
//              Change bank account
// Changing it (verified only) opens the setup alone ("Which account should
// we pay into instead?"). The new one is checked while the old one keeps
// working:
//   checking   a blue line: "Checking SBI ••5894. Withdrawals keep going
//              to HDFC Bank ••4521 until it's verified." and Cancel change
//   needs-fix  amber: what's wrong, Fix it and Cancel change
//   passed     green: "SBI ••5894 is verified. Withdrawals now go to it."
//
// Sales → Withdraw money's card (WithdrawalsTab.jsx) sends coaches here
// for all of these, so this is the one place they're set up or fixed.
//
// onWithdraw(): go to Sales → Withdraw money
// ------------------------------------------------------------

// The payout state now, re-read when it changes and every second while a
// check is running, so it ends on screen as soon as it does
export function usePayout() {
  const [, setTick] = useState(0);
  useEffect(() => onPayoutsChange(() => setTick((n) => n + 1)), []);
  const state = payoutState(Date.now());
  const checking =
    state.kyc.status === 'checking' || state.bank.status === 'checking' || state.bank.pending?.status === 'checking';
  useEffect(() => {
    if (!checking) return undefined;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [checking]);
  return state;
}

// Whose name the account must be in, as a sentence
function payeeLine(kyc) {
  const payee = payeeOf(kyc);
  if (kyc.type !== 'business') return `It must be in your own name, ${titleCase(payee.name)}.`;
  if (payee.also) {
    return `It can be in your business’s name, ${titleCase(payee.name)}, or your own, ${titleCase(payee.also)}.`;
  }
  return `It must be in the business’s name, ${titleCase(payee.name)}.`;
}

// Moves the keyboard to a heading when a screen changes, so it isn't lost
// when the button that was pressed disappears
function useFocusOnChange(key) {
  const ref = useRef(null);
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    ref.current?.focus();
  }, [key]);
  return ref;
}

export default function PaymentDetails({ onWithdraw }) {
  const payout = usePayout();
  const { kyc, bank } = payout;
  // What's open: null (the page), 'identity', 'bank' (adding or fixing
  // the account), 'change' (a new account), 'fix-change'
  const [editing, setEditing] = useState(null);
  // Checks that end while they're here get a moment of their own
  const [sawCheck, setSawCheck] = useState(kyc.status === 'checking' || bank.status === 'checking');
  const [sawChange, setSawChange] = useState(bank.pending?.status === 'checking');
  const pendingStatus = bank.pending?.status ?? null;
  const top = useFocusOnChange(editing);

  useEffect(() => {
    if (kyc.status === 'checking' || bank.status === 'checking') setSawCheck(true);
  }, [kyc.status, bank.status]);
  useEffect(() => {
    if (pendingStatus === 'checking') setSawChange(true);
  }, [pendingStatus]);
  useEffect(() => {
    if (editing === 'fix-change' && pendingStatus !== 'needs-fix') setEditing(null);
  }, [editing, pendingStatus]);

  if (editing === 'identity') {
    const fixing = kyc.status === 'needs-fix';
    return (
      <IdentitySetup
        start={fixing ? kyc : null}
        problems={fixing ? kyc.problems : []}
        onCancel={() => setEditing(null)}
        onSubmit={(details) => {
          const ok = submitKyc(details);
          if (ok) setEditing(null);
          return ok;
        }}
      />
    );
  }

  if (editing === 'bank') {
    const fixing = bank.status === 'needs-fix';
    return (
      <BankSetup
        start={fixing ? bank.bank : { holder: titleCase(payeeOf(kyc).name) }}
        problem={fixing ? bank.problem : null}
        payeeLine={payeeLine(kyc)}
        onCancel={() => setEditing(null)}
        onSubmit={(details) => {
          submitBank(details);
          setEditing(null);
        }}
      />
    );
  }

  if (editing === 'change' || editing === 'fix-change') {
    const fixing = editing === 'fix-change';
    return (
      <BankSetup
        change
        start={fixing ? bank.pending.bank : { holder: bank.bank.holder }}
        problem={fixing ? bank.pending.problem : null}
        payeeLine={payeeLine(kyc)}
        current={bank.bank}
        onCancel={() => setEditing(null)}
        onSubmit={(details) => {
          submitBankChange(details);
          setSawChange(true);
          setEditing(null);
        }}
      />
    );
  }

  const justReady = sawCheck && payout.ready && !bank.pending;
  const justChanged = !justReady && sawChange && !bank.pending && bank.changedAt;

  return (
    <div className="po">
      <h3 className="oh__sr-only" tabIndex={-1} ref={top}>
        Identity and bank account
      </h3>

      {justReady && (
        <div className="po-alert po-alert--done" role="status">
          <CircleCheck size={18} aria-hidden="true" />
          <div className="po-alert__grow">
            <p className="po-alert__title">You’re ready to withdraw</p>
            <p>
              Your {kyc.type === 'business' ? 'business' : 'identity'} and {bank.bank.bankName} {maskAccount(bank.bank.account)} are verified.
            </p>
          </div>
          {onWithdraw && (
            <button type="button" className="oh__add" onClick={onWithdraw}>
              Withdraw money
            </button>
          )}
        </div>
      )}

      {justChanged && (
        <div className="po-alert po-alert--done" role="status">
          <CircleCheck size={18} aria-hidden="true" />
          <div className="po-alert__grow">
            <p className="po-alert__title">
              {bank.bank.bankName} {maskAccount(bank.bank.account)} is verified
            </p>
            <p>Withdrawals now go to it.</p>
          </div>
        </div>
      )}

      <IdentityCard
        kyc={kyc}
        bankAdded={bank.status !== 'none'}
        onStart={() => setEditing('identity')} onFix={() => setEditing('identity')} />

      <BankCard
        payout={payout}
        onAdd={() => setEditing('bank')}
        onChange={() => setEditing('change')}
        onFixChange={() => setEditing('fix-change')}
      />
    </div>
  );
}

// ---------- The bank account on the page ----------

function BankCard({ payout, onAdd, onChange, onFixChange }) {
  const { kyc, bank } = payout;

  if (bank.status === 'none') {
    const locked = kyc.status === 'none';
    return (
      <section className={`po-part ${locked ? 'po-part--locked' : ''}`} aria-labelledby="po-bank-title">
        <div className="po-part__head">
          <span className="po-tile" aria-hidden="true">
            <Landmark size={20} />
          </span>
          <div className="po-part__who">
            <h3 className="po-part__title" id="po-bank-title">
              Add your bank account
            </h3>
            <p className="po-part__sub">Where your earnings are sent when you withdraw</p>
          </div>
        </div>
        <div className="po-part__body">
          {locked ? (
            <p className="po-part__text">
              You can add it once you’ve sent your documents above. The account must be in the same name, and we
              check it is.
            </p>
          ) : (
            <>
              <p className="po-part__text">
                {payeeLine(kyc)} We send it ₹1 to check.
              </p>
              {/* A fix to identity comes first, so this one waits quietly */}
              <button
                type="button"
                className={kyc.status === 'needs-fix' ? 'oh__edit' : 'oh__add'}
                onClick={onAdd}
              >
                Add bank account
              </button>
            </>
          )}
        </div>
      </section>
    );
  }

  const pending = bank.pending;
  const current = `${bank.bank.bankName} ${maskAccount(bank.bank.account)}`;
  const pill =
    bank.status === 'verified' ? (
      <span className="po-pill po-pill--done">Verified</span>
    ) : bank.status === 'checking' ? (
      <span className="po-pill po-pill--processing">Checking</span>
    ) : (
      <span className="po-pill po-pill--refund">Needs a fix</span>
    );

  return (
    <section className="po-part" aria-labelledby="po-bank-title">
      <div className="po-part__head">
        <span className="po-tile" aria-hidden="true">
          {bank.status === 'checking' ? <Loader2 size={20} className="po-spin" /> : <Landmark size={20} />}
        </span>
        <div className="po-part__who">
          <h3 className="po-part__title" id="po-bank-title">
            {current}
          </h3>
          <p className="po-part__sub">{bank.bank.branch}</p>
        </div>
        {pill}
      </div>

      {bank.status === 'checking' && (
        <p className="po-part__note po-part__note--checking" role="status">
          We’re sending ₹1 to {current} to make sure it’s yours. This usually takes a few minutes, and you can leave
          this page.
        </p>
      )}

      {bank.status === 'needs-fix' && (
        <div className="po-alert po-alert--fix po-part__alert" role="alert">
          <AlertTriangle size={18} aria-hidden="true" />
          <div className="po-alert__grow">
            <p className="po-alert__title">Your bank account needs a fix</p>
            <p>{bank.problem.message}</p>
            <div className="po-alert__actions">
              <button type="button" className="oh__add" onClick={onAdd}>
                Fix it
              </button>
            </div>
          </div>
        </div>
      )}

      {pending?.status === 'checking' && (
        <div className="po-alert po-alert--checking po-part__alert" role="status">
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
        <div className="po-alert po-alert--fix po-part__alert" role="alert">
          <AlertTriangle size={18} aria-hidden="true" />
          <div className="po-alert__grow">
            <p className="po-alert__title">
              Your new account, {pending.bank.bankName} {maskAccount(pending.bank.account)}, needs a fix
            </p>
            <p>{pending.problem.message}</p>
            <p className="po-alert__more">Withdrawals still go to {current}.</p>
            <div className="po-alert__actions">
              <button type="button" className="oh__add" onClick={onFixChange}>
                Fix it
              </button>
              <button type="button" className="po-link" onClick={() => cancelBankChange()}>
                Cancel change
              </button>
            </div>
          </div>
        </div>
      )}

      <dl className="po-dl">
        <div>
          <dt>Account holder</dt>
          <dd>{bank.bank.holder}</dd>
        </div>
        <div>
          <dt>IFSC</dt>
          <dd>{bank.bank.ifsc}</dd>
        </div>
        {bank.verifiedAt && (
          <div>
            <dt>Verified on</dt>
            <dd>
              {new Date(bank.verifiedAt).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </dd>
          </div>
        )}
      </dl>

      {bank.status === 'verified' && !pending && (
        <div className="po-card__foot">
          <button type="button" className="oh__edit" onClick={onChange}>
            Change bank account
          </button>
        </div>
      )}
    </section>
  );
}

// ---------- Adding, fixing or changing the account ----------
// start: what they gave before (fixing), or the name to start with;
// problem: what to fix ({ field, message }), shown on that field;
// payeeLine: whose name it must be in, as a sentence;
// current: the account being replaced, when changing.
// onSubmit({ account, ifsc, holder })
function BankSetup({ start, problem, payeeLine: whose, onCancel, onSubmit, change = false, current = null }) {
  const [ifsc, setIfsc] = useState(start?.ifsc ?? '');
  const [account, setAccount] = useState(start?.account ?? '');
  const [again, setAgain] = useState(start?.account ?? '');
  const [holder, setHolder] = useState(start?.holder ?? '');
  const [tried, setTried] = useState(Boolean(problem));
  // A problem from the check stays on its field until that field changes
  const [checkProblem, setCheckProblem] = useState(problem);
  const first = useRef(null);

  // The keyboard goes to the first field, or the one to fix
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const fix = checkProblem && document.getElementById(`po-${checkProblem.field}`);
      (fix || first.current)?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const errors = {
    ifsc: ifscProblem(ifsc),
    account: accountProblem(account, again) ?? (checkProblem?.field === 'account' ? checkProblem.message : null),
    holder: holderProblem(holder) ?? (checkProblem?.field === 'holder' ? checkProblem.message : null),
  };
  const hasError = Object.values(errors).some(Boolean);
  const show = (field) => (tried ? errors[field] : null);

  const next = () => {
    setTried(true);
    if (hasError) return;
    onSubmit({ account, ifsc, holder: holder.trim() });
  };

  const bankInfo = lookupIfsc(ifsc);

  return (
    <div className="po po-setup">
      <div className="po-setup__top">
        <button type="button" className="po-back" onClick={onCancel}>
          <ArrowLeft size={16} aria-hidden="true" /> Cancel
        </button>
      </div>

      <h3 className="po-setup__title">
        {change ? 'Which account should we pay into instead?' : 'Which bank account should we pay into?'}
      </h3>
      <p className="po-setup__help">
        {whose}
        {change && current
          ? ` Withdrawals keep going to ${current.bankName} ${maskAccount(current.account)} until the new one is checked.`
          : ''}
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
            aria-describedby="po-account-note"
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

      <div className="po-actions">
        <button type="button" className="oh__add" onClick={next}>
          {change ? 'Verify new account' : 'Verify account'}
        </button>
      </div>
      <p className="po-setup__fine">We’ll send ₹1 to this account to check it’s yours.</p>
    </div>
  );
}

// ---------- Prototype controls (not part of the product) ----------
// Rows for a Prototype controls panel (PrototypeControls.css): start as a
// new coach or the demo's verified one, how the next identity and bank
// checks end, and ending running checks now. Used on Settings and under
// Sales.
export function PayoutControlRows() {
  const payout = usePayout();
  const fresh = payout.kyc.status === 'none' && payout.bank.status === 'none';
  const running =
    payout.kyc.status === 'checking' ||
    payout.bank.status === 'checking' ||
    payout.bank.pending?.status === 'checking';
  return (
    <>
      <div className="proto__row">
        <span className="proto__label">Payment details</span>
        <div className="proto__controls">
          <button type="button" className="proto__btn" aria-pressed={fresh} onClick={startFresh}>
            New coach, nothing added
          </button>
          <button type="button" className="proto__btn" onClick={resetToDemo}>
            Demo, all verified
          </button>
          {running && (
            <button type="button" className="proto__btn" onClick={() => finishChecksNow()}>
              Finish the checks now
            </button>
          )}
        </div>
      </div>
      <div className="proto__row">
        <span className="proto__label">Next identity check</span>
        <div className="proto__controls">
          {KYC_OUTCOMES.map((o) => (
            <button
              key={o.id}
              type="button"
              className="proto__btn"
              aria-pressed={(payout.next.kyc ?? 'approve') === o.id}
              onClick={() => setNextOutcome('kyc', o.id)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div className="proto__row">
        <span className="proto__label">Next bank check</span>
        <div className="proto__controls">
          {BANK_OUTCOMES.map((o) => (
            <button
              key={o.id}
              type="button"
              className="proto__btn"
              aria-pressed={(payout.next.bank ?? 'approve') === o.id}
              onClick={() => setNextOutcome('bank', o.id)}
            >
              {o.label}
            </button>
          ))}
          <p className="proto__note">
            In the prototype an identity check takes {KYC_CHECK_MS / 1000} seconds and a bank check {CHECK_MS / 1000}.
            After a failed one, the next goes through unless you pick again.
          </p>
        </div>
      </div>
    </>
  );
}