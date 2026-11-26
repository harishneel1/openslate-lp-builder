import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CircleCheck, Landmark, Loader2, Lock, MapPin } from 'lucide-react';
import {
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
  startFresh,
  submitBank,
  submitBankChange,
  submitKyc,
  kycFinished,
  pickKycOutcome,
} from '../data/payouts';
import { IdentityCard, IdentitySetup, titleCase } from './IdentitySetup';
import { InvoiceSetup, InvoicesCard, useInvoiceSettings } from './InvoiceSettings';
import { clearInvoiceSettings, gstOfSettings, hasAddress, resetInvoiceSettings } from '../data/invoiceSettings';
import './PaymentSteps.css';

// ------------------------------------------------------------
// Settings → Payment details: where the coach's money goes and who they
// are (data/payouts.js). Three steps, each its own page under Payment
// details in the Settings menu, done in this order:
//
//   1. Bank account        BankStep: the account withdrawals go to. Saved
//                          as typed; nothing is checked yet.
//   2. Address & invoice   AddressStep: the name and address on invoices
//                          (InvoiceSettings.jsx). Needs an address and PIN.
//   3. Verify KYC          KycStep: PAN and Aadhaar, or the business's
//                          documents (IdentitySetup.jsx). This is the one
//                          submission: the bank account, address and
//                          documents go to our payment partner together.
//                          When it's verified, so is the bank account.
//
// A step stays locked until the one before it is done (stepsOf): greyed
// in the Settings menu, not clickable, with the reason on hover. (If one is
// opened anyway, its page says what's missing, with a button to go there:
// LockedStep.) Saving a step for the first time ends on "Saved" and a Next
// button to the following step, so it's always clear what's next.
//
// Settings → Payment details on its own (the KYC banner's Complete KYC,
// Sales' Get started) opens the first step that isn't done (currentStep).
//
// Withdrawing needs KYC verified. When it passes while they're here:
// "You're ready to withdraw" and a Withdraw money button back to Sales.
//
// Bank card, by status:
//   none       what it's for, and Add bank account
//   added      their details, masked, with a grey Saved pill, and Edit
//              (until KYC is sent; after that it's sent with it)
//   verified   a green Verified pill, and Change bank account
// Changing a verified account (bank.pending) is unchanged for now.
//
// Sales → Withdraw money's card (WithdrawalsTab.jsx) sends coaches here
// for all of these, so this is the one place they're set up.
// ------------------------------------------------------------

// The steps, in order: { id, label }. id is the Settings page's id.
export const PAYMENT_STEPS = [
  { id: 'payments-bank', label: 'Bank account', short: 'Bank account' },
  { id: 'payments-address', label: 'Address & invoice', short: 'Address & invoice' },
  { id: 'payments-kyc', label: 'Verify KYC', short: 'Verify KYC' },
];

// What's done, and what's locked and why: { done: { [id]: bool },
// locked: { [id]: { reason, goTo } | null } }
export function stepsOf(payout, invoices) {
  const bankDone = payout.bank.status !== 'none';
  const addressDone = hasAddress(invoices);
  const kycDone = payout.kyc.status !== 'none';
  return {
    done: { 'payments-bank': bankDone, 'payments-address': addressDone, 'payments-kyc': kycDone },
    locked: {
      'payments-bank': null,
      'payments-address': bankDone ? null : { reason: 'Add your bank account first', goTo: 'payments-bank' },
      'payments-kyc': !bankDone
        ? { reason: 'Add your bank account first', goTo: 'payments-bank' }
        : !addressDone
          ? { reason: 'Add your address and PIN first', goTo: 'payments-address' }
          : null,
    },
  };
}

// The first step that isn't done (the last one once everything is)
export function currentStep(payout, invoices) {
  const { done } = stepsOf(payout, invoices);
  return PAYMENT_STEPS.find((st) => !done[st.id])?.id ?? 'payments-kyc';
}

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

// Whose name the account must be in, as a sentence (changing a verified one)
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

// ---------- One step's page ----------
// step: 'payments-bank' | 'payments-address' | 'payments-kyc'
// onGo(step): open another step (Next, and a locked step's Go there)
// onWithdraw(): go to Sales → Withdraw money
export default function PaymentStep({ step, onGo, onWithdraw }) {
  const payout = usePayout();
  const invoices = useInvoiceSettings();
  const lock = stepsOf(payout, invoices).locked[step];

  if (lock) return <LockedStep step={step} lock={lock} onGo={onGo} />;
  if (step === 'payments-address') return <AddressStep payout={payout} invoices={invoices} onGo={onGo} />;
  if (step === 'payments-kyc') return <KycStep payout={payout} invoices={invoices} onWithdraw={onWithdraw} />;
  return <BankStep payout={payout} onGo={onGo} />;
}

// A step that can't be done yet: what's missing, and a button to go there
function LockedStep({ step, lock, onGo }) {
  const label = PAYMENT_STEPS.find((st) => st.id === step)?.label;
  const there = PAYMENT_STEPS.find((st) => st.id === lock.goTo)?.label;
  return (
    <div className="po">
      <div className="ps-locked" role="status">
        <span className="ps-locked__icon" aria-hidden="true">
          <Lock size={20} />
        </span>
        <h3 className="ps-locked__title">{label} is locked</h3>
        <p className="ps-locked__text">{lock.reason}. It unlocks as soon as you have.</p>
        <button type="button" className="oh__add" onClick={() => onGo(lock.goTo)}>
          Go to {there} <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

// "Saved" and the way on, after a step is saved for the first time
function SavedNext({ title, text, nextLabel, onNext }) {
  return (
    <div className="po-alert po-alert--done" role="status">
      <CircleCheck size={18} aria-hidden="true" />
      <div className="po-alert__grow">
        <p className="po-alert__title">{title}</p>
        <p>{text}</p>
      </div>
      <button type="button" className="oh__add" onClick={onNext}>
        Next: {nextLabel} <ArrowRight size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

// ---------- Step 1: Bank account ----------
function BankStep({ payout, onGo }) {
  const { kyc, bank } = payout;
  // What's open: null (the page), 'bank' (adding or editing), 'change' (a
  // new account for a verified one), 'fix-change'
  const [editing, setEditing] = useState(null);
  const [justSaved, setJustSaved] = useState(false);
  const pendingStatus = bank.pending?.status ?? null;
  const top = useFocusOnChange(editing);

  useEffect(() => {
    if (editing === 'fix-change' && pendingStatus !== 'needs-fix') setEditing(null);
  }, [editing, pendingStatus]);

  if (editing === 'bank') {
    return (
      <BankSetup
        start={bank.bank}
        onCancel={() => setEditing(null)}
        onSubmit={(details) => {
          const first = bank.status === 'none';
          if (submitBank(details)) {
            setJustSaved(first);
            setEditing(null);
          }
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
          setEditing(null);
        }}
      />
    );
  }

  return (
    <div className="po">
      <h3 className="oh__sr-only" tabIndex={-1} ref={top}>
        Bank account
      </h3>
      {justSaved && bank.status === 'added' && (
        <SavedNext
          title="Bank account saved"
          text="Now add the address for your invoices."
          nextLabel="Address & invoice"
          onNext={() => onGo('payments-address')} />
      )}
      <BankCard
        payout={payout}
        onAdd={() => setEditing('bank')}
        onChange={() => setEditing('change')}
        onFixChange={() => setEditing('fix-change')}
      />
    </div>
  );
}

// ---------- Step 2: Address & invoice ----------
function AddressStep({ payout, invoices, onGo }) {
  const { kyc } = payout;
  const [editing, setEditing] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const top = useFocusOnChange(editing);
  const done = hasAddress(invoices);

  if (editing) {
    return (
      <InvoiceSetup
        onDone={() => setEditing(false)}
        onSaved={() => {
          if (!done) setJustSaved(true);
        }}
      />
    );
  }

  return (
    <div className="po">
      <h3 className="oh__sr-only" tabIndex={-1} ref={top}>
        Address and invoice
      </h3>
      {justSaved && done && kyc.status === 'none' && (
        <SavedNext
          title="Address saved"
          text="Last step: verify your KYC."
          nextLabel="Verify KYC"
          onNext={() => onGo('payments-kyc')} />
      )}
      {done ? (
        <InvoicesCard onEdit={() => setEditing(true)} />
      ) : (
        <div className="po-part">
          <div className="po-part__head">
            <span className="po-tile po-tile--inv" aria-hidden="true">
              <MapPin size={20} />
            </span>
            <div className="po-part__who">
              <h4 className="po-part__title">Add your address</h4>
              <p className="po-part__sub">Not added yet</p>
            </div>
          </div>
          <div className="po-part__body">
            <p className="po-part__text">
              The name and address on the invoices your buyers get. We need your address and PIN before you can verify
              your KYC.
            </p>
            <button type="button" className="oh__add" onClick={() => setEditing(true)}>
              Add address
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Step 3: Verify KYC ----------
function KycStep({ payout, invoices, onWithdraw }) {
  const { kyc, bank } = payout;
  const [editing, setEditing] = useState(false);
  // A check that ends while they're here gets a moment of its own
  const [sawCheck, setSawCheck] = useState(kyc.status === 'checking');
  const top = useFocusOnChange(editing);

  useEffect(() => {
    if (kyc.status === 'checking') setSawCheck(true);
  }, [kyc.status]);

  if (editing) {
    const fixing = kyc.status === 'needs-fix';
    return (
      <IdentitySetup
        start={fixing ? kyc : null}
        problems={fixing ? kyc.problems : []}
        bankHolder={bank.bank}
        invoiceGstin={gstOfSettings(invoices)?.gstin ?? ''}
        onCancel={() => setEditing(false)}
        onSubmit={(details) => {
          const ok = submitKyc(details);
          if (ok) setEditing(false);
          return ok;
        }}
      />
    );
  }

  const justReady = sawCheck && payout.ready;

  return (
    <div className="po">
      <h3 className="oh__sr-only" tabIndex={-1} ref={top}>
        Verify KYC
      </h3>

      {justReady && (
        <div className="po-alert po-alert--done" role="status">
          <CircleCheck size={18} aria-hidden="true" />
          <div className="po-alert__grow">
            <p className="po-alert__title">You’re ready to withdraw</p>
            <p>
              Your {kyc.type === 'business' ? 'business' : 'identity'} and {bank.bank.bankName}{' '}
              {maskAccount(bank.bank.account)} are verified.
            </p>
          </div>
          {onWithdraw && (
            <button type="button" className="oh__add" onClick={onWithdraw}>
              Withdraw money
            </button>
          )}
        </div>
      )}

      <IdentityCard kyc={kyc} onStart={() => setEditing(true)} onFix={() => setEditing(true)} />
    </div>
  );
}

// ---------- The bank account on the page ----------

function BankCard({ payout, onAdd, onChange, onFixChange }) {
  const { kyc, bank } = payout;

  if (bank.status === 'none') {
    return (
      <div className="po-part">
        <div className="po-part__head">
          <span className="po-tile" aria-hidden="true">
            <Landmark size={20} />
          </span>
          <div className="po-part__who">
            <h4 className="po-part__title">Add your bank account</h4>
            <p className="po-part__sub">Not added yet</p>
          </div>
        </div>
        <div className="po-part__body">
          <p className="po-part__text">
            Where your withdrawals go. It should be in your own name, or your business’s: you’ll give the PAN that
            matches it when you verify your KYC.
          </p>
          <button type="button" className="oh__add" onClick={onAdd}>
            Add bank account
          </button>
        </div>
      </div>
    );
  }

  const pending = bank.pending;
  const current = `${bank.bank.bankName} ${maskAccount(bank.bank.account)}`;
  const pill =
    bank.status === 'verified' ? (
      <span className="po-pill po-pill--done">Verified</span>
    ) : bank.status === 'added' ? (
      <span className="po-pill po-pill--off">Saved</span>
    ) : bank.status === 'checking' ? (
      <span className="po-pill po-pill--processing">Checking</span>
    ) : (
      <span className="po-pill po-pill--refund">Needs a fix</span>
    );

  return (
    <div className="po-part">
      <div className="po-part__head">
        <span className="po-tile" aria-hidden="true">
          {bank.status === 'checking' ? <Loader2 size={20} className="po-spin" /> : <Landmark size={20} />}
        </span>
        <div className="po-part__who">
          <h4 className="po-part__title">{current}</h4>
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

      {bank.status === 'added' && (
        <p className="po-part__note">
          {kyc.status === 'none'
            ? 'Verified along with your KYC, so you can still edit it until then.'
            : 'Sent with your KYC, and verified along with it.'}
        </p>
      )}

      {bank.status === 'added' && kyc.status === 'none' && (
        <div className="po-card__foot">
          <button type="button" className="oh__edit" onClick={onAdd}>
            Edit bank account
          </button>
        </div>
      )}

      {bank.status === 'verified' && !pending && (
        <div className="po-card__foot">
          <button type="button" className="oh__edit" onClick={onChange}>
            Change bank account
          </button>
        </div>
      )}
    </div>
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
        {change
          ? whose
          : 'It should be in your own name, or your business’s. You’ll give the PAN that matches it when you verify your KYC.'}
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
          {change ? 'Verify new account' : 'Save bank account'}
        </button>
      </div>
      {change && <p className="po-setup__fine">We’ll send ₹1 to this account to check it’s yours.</p>}
    </div>
  );
}

// ---------- Prototype controls (not part of the product) ----------
// Rows for a Prototype controls panel (PrototypeControls.css): start as a
// new coach (no bank account, address or KYC) or the demo's verified one,
// how the next KYC check ends (or, once one has ended, what it says now,
// including Razorpay pausing the account: suspended), and ending a running
// check now. Used on
// Settings and under Sales.
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
          <button
            type="button"
            className="proto__btn"
            aria-pressed={fresh}
            onClick={() => {
              startFresh();
              clearInvoiceSettings();
            }}
          >
            New coach, nothing added
          </button>
          <button type="button" className="proto__btn" onClick={resetToDemo}>
            Demo, all verified
          </button>
          <button type="button" className="proto__btn" onClick={resetInvoiceSettings}>
            Invoice details back to the start
          </button>
          {running && (
            <button type="button" className="proto__btn" onClick={() => finishChecksNow()}>
              Finish the checks now
            </button>
          )}
        </div>
      </div>
      <div className="proto__row">
        <span className="proto__label">Next KYC check</span>
        <div className="proto__controls">
          {KYC_OUTCOMES.filter((o) => !o.afterCheck || kycFinished(payout.kyc.status)).map((o) => (
            <button
              key={o.id}
              type="button"
              className="proto__btn"
              aria-pressed={
                kycFinished(payout.kyc.status)
                  ? payout.kyc.status === 'suspended'
                    ? o.id === 'suspended'
                    : payout.kyc.outcome === o.id
                  : (payout.next.kyc ?? 'approve') === o.id
              }
              onClick={() => pickKycOutcome(o.id)}
            >
              {o.label}
            </button>
          ))}
          <p className="proto__note">
            In the prototype a KYC check takes {KYC_CHECK_MS / 1000} seconds. After a failed one, the next goes through
            unless you pick again. Once a check has ended, picking one changes the result straight away. Not approved, paused and
            the unknown reason end in Book a call, not Fix it.
          </p>
        </div>
      </div>
    </>
  );
}