// ------------------------------------------------------------
// Payouts: the bank account a coach's money is withdrawn to, and its KYC
// (Settings → Bank account, screens/SettingsPage.jsx and PayoutSetup.jsx).
//
// What the real product does, behind the scenes (Razorpay Route): the
// coach gives their PAN and bank account; our server creates their
// Razorpay "linked account" with those details and asks for Route to be
// switched on; Razorpay checks the PAN against government records and
// sends ₹1 to the account ("penny drop") to make sure it exists and the
// name on it matches the PAN. Then it's activated, or it needs a fix.
// Until then the coach can still sell: their money waits in the wallet.
// The prototype pretends that check takes CHECK_MS and ends however
// Prototype controls say (nextOutcome).
//
// Its state:
//   none       no bank account yet: withdrawing isn't possible
//   checking   sent for checking (submittedAt)
//   needs-fix  the check found a problem: { step, field, message }, so the
//              setup can open on the step and field to fix
//   verified   ready: withdrawals go to this account
//
// Changing a verified account (submitBankChange): the new one is checked
// as a pending change, and withdrawals keep going to the old one until it
// passes. If it needs a fix, the old one still works; the change can be
// fixed or cancelled. Withdrawals already on their way aren't affected
// (each keeps the account it was sent to). The PAN can't be changed here.
//   pending: { status: 'checking' | 'needs-fix', bank, problem, submittedAt }
//
// Kept in this browser (localStorage) under KEY:
//   { status, pan, panName, bank: { account, ifsc, bankName, branch, holder },
//     submittedAt, verifiedAt, outcome, nextOutcome,
//     pending: { bank, submittedAt, outcome } or null }
//   outcome:     how this check ends: 'approve' | 'name-mismatch' | 'no-account'
//   nextOutcome: how the next check will end (Prototype controls)
// With nothing saved, the demo account is already verified: HDFC Bank
// ••4521, the one the demo history's withdrawals went to.
// ------------------------------------------------------------

const KEY = 'pagebuilder:payouts';
const CHANGED_EVENT = 'payouts-changed';

// How long the check takes in the prototype. Real ones take from seconds
// to a few hours when Razorpay reviews by hand.
export const CHECK_MS = 8000;

// The demo account, matching the withdrawals in the demo history
const DEMO = {
  status: 'verified',
  pan: 'ABCPN1234F',
  panName: 'HARISH NEEL',
  bank: {
    account: '50100234564521',
    ifsc: 'HDFC0001234',
    bankName: 'HDFC Bank',
    branch: 'Kodambakkam, Chennai',
    holder: 'Harish Neel',
  },
  submittedAt: null,
  verifiedAt: null,
  outcome: 'approve',
  nextOutcome: 'approve',
  pending: null,
};

const NONE = {
  status: 'none',
  pan: '',
  panName: '',
  bank: null,
  submittedAt: null,
  verifiedAt: null,
  outcome: 'approve',
  nextOutcome: 'approve',
  pending: null,
};

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!saved || typeof saved !== 'object') return { ...DEMO };
    return { ...NONE, ...saved };
  } catch {
    return { ...DEMO };
  }
}

function save(next) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(CHANGED_EVENT));
    return true;
  } catch {
    return false;
  }
}

// A change here or in another tab. Returns the unsubscribe.
export function onPayoutsChange(callback) {
  const fromOtherTab = (e) => {
    if (e.key === KEY || e.key === null) callback();
  };
  window.addEventListener(CHANGED_EVENT, callback);
  window.addEventListener('storage', fromOtherTab);
  return () => {
    window.removeEventListener(CHANGED_EVENT, callback);
    window.removeEventListener('storage', fromOtherTab);
  };
}

// ---------- The state now ----------

// What a failed check says, and where to fix it
function problemOf(outcome, s) {
  if (outcome === 'name-mismatch') {
    return {
      step: 'bank',
      field: 'holder',
      message: `The name on this bank account doesn’t match your PAN (${s.panName}). Use an account in your own name.`,
    };
  }
  if (outcome === 'no-account') {
    return {
      step: 'bank',
      field: 'account',
      message: `We couldn’t find this account at ${s.bank?.bankName ?? 'your bank'}. Check the account number and IFSC.`,
    };
  }
  return null;
}

// { status, pan, panName, bank, problem, submittedAt, verifiedAt,
//   nextOutcome, pending }
// A check that has run its time ends as its outcome says. A change that
// passes makes its account the one withdrawals go to (changedAt: when).
export function payoutState(now = Date.now()) {
  const s = load();
  let st = { ...s, problem: null };
  if (s.status === 'checking' && Number.isFinite(s.submittedAt) && now >= s.submittedAt + CHECK_MS) {
    const problem = problemOf(s.outcome, s);
    st = problem
      ? { ...s, status: 'needs-fix', problem }
      : { ...s, status: 'verified', problem: null, verifiedAt: s.submittedAt + CHECK_MS };
  }

  const p = s.pending;
  if (st.status !== 'verified' || !p) return { ...st, pending: null };
  if (now < p.submittedAt + CHECK_MS) return { ...st, pending: { ...p, status: 'checking', problem: null } };
  const problem = problemOf(p.outcome, { ...s, bank: p.bank });
  if (problem) return { ...st, pending: { ...p, status: 'needs-fix', problem } };
  return { ...st, bank: p.bank, verifiedAt: p.submittedAt + CHECK_MS, changedAt: p.submittedAt + CHECK_MS, pending: null };
}

// What's saved, with checks that have ended written in, so a new change
// starts from the account that's really current
function settled(now) {
  const st = payoutState(now);
  const raw = load();
  return {
    ...raw,
    status: st.status,
    bank: st.bank,
    verifiedAt: st.verifiedAt,
    submittedAt: st.submittedAt,
    outcome: st.status === 'needs-fix' ? raw.outcome : 'approve',
    pending: st.pending ? raw.pending : null,
  };
}

// The verified account in the shape withdrawals use ({ name, last4,
// holder }), or null when there isn't one
export function verifiedBank(now = Date.now()) {
  const s = payoutState(now);
  if (s.status !== 'verified' || !s.bank) return null;
  return { name: s.bank.bankName, last4: s.bank.account.slice(-4), holder: s.bank.holder };
}

// ---------- Checking what they type ----------

// A personal PAN: 5 letters, 4 digits, 1 letter, and P 4th ("person")
export const cleanPan = (text) => String(text ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);

export function panProblem(pan) {
  if (!pan) return 'Enter your PAN.';
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) return 'A PAN looks like ABCPE1234F: 5 letters, 4 numbers, 1 letter.';
  if (pan[3] !== 'P') return 'This is a business PAN. Use your personal PAN (its 4th letter is P).';
  return null;
}

// The name a PAN is registered to. Made up in the prototype: every
// personal PAN belongs to the coach. The real product asks the
// government's records, through Razorpay or a KYC service.
export const panNameOf = (pan) => (panProblem(pan) ? '' : 'HARISH NEEL');

// IFSC: 4 letters, 0, then 6 letters or numbers. The bank and branch come
// from a lookup; the real product can use Razorpay's free IFSC service.
const IFSC_BOOK = {
  HDFC0001234: { bankName: 'HDFC Bank', branch: 'Kodambakkam, Chennai' },
  SBIN0016066: { bankName: 'State Bank of India', branch: 'T Nagar, Chennai' },
  ICIC0000104: { bankName: 'ICICI Bank', branch: 'Anna Nagar, Chennai' },
  UTIB0000048: { bankName: 'Axis Bank', branch: 'Mylapore, Chennai' },
  KKBK0000463: { bankName: 'Kotak Mahindra Bank', branch: 'Adyar, Chennai' },
};
export const IFSC_EXAMPLE = 'HDFC0001234';

export const cleanIfsc = (text) => String(text ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11);

// { bankName, branch } for a known IFSC, or null
export const lookupIfsc = (code) => IFSC_BOOK[code] ?? null;

export function ifscProblem(code) {
  if (!code) return 'Enter your branch’s IFSC.';
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(code)) return 'An IFSC is 11 characters, like HDFC0001234.';
  if (!lookupIfsc(code)) return 'We couldn’t find this IFSC. It’s on your cheque book and in your bank’s app.';
  return null;
}

export const cleanAccount = (text) => String(text ?? '').replace(/\D/g, '').slice(0, 18);

export function accountProblem(account, again) {
  if (!account) return 'Enter your account number.';
  if (account.length < 9) return 'Account numbers have 9 to 18 digits.';
  if (again !== undefined && again !== account) return 'The two account numbers don’t match.';
  return null;
}

export function holderProblem(name) {
  if (!String(name ?? '').trim()) return 'Enter the name on the account.';
  return null;
}

// ---------- Showing it ----------

// '50100234564521' → '••4521', as Sales writes it
export const maskAccount = (account) => `••${String(account ?? '').slice(-4)}`;

// 'ABCPN1234F' → 'ABC•••••4F': the first 3 and last 2
export const maskPan = (pan) => (pan ? `${pan.slice(0, 3)}•••••${pan.slice(-2)}` : '');

// ---------- Changing it ----------

// Sends the details for checking
export function submitPayout({ pan, panName, bank }, now = Date.now()) {
  const s = load();
  return save({
    ...s,
    status: 'checking',
    pan,
    panName,
    bank: { ...bank, ...lookupIfsc(bank.ifsc) },
    submittedAt: now,
    verifiedAt: null,
    outcome: s.nextOutcome ?? 'approve',
    // A fix after a failed check goes through, unless they choose otherwise
    nextOutcome: 'approve',
  });
}

// Checks a new account for a verified one. Withdrawals keep going to the
// old one until the new one passes.
export function submitBankChange(bank, now = Date.now()) {
  const s = settled(now);
  if (s.status !== 'verified') return false;
  return save({
    ...s,
    pending: { bank: { ...bank, ...lookupIfsc(bank.ifsc) }, submittedAt: now, outcome: s.nextOutcome ?? 'approve' },
    nextOutcome: 'approve',
  });
}

// Drops a change that's being checked or needs a fix; the old account stays
export const cancelBankChange = (now = Date.now()) => save({ ...settled(now), pending: null });

// ---------- Prototype controls (not part of the product) ----------

export const OUTCOMES = [
  { id: 'approve', label: 'Verified' },
  { id: 'name-mismatch', label: 'Name doesn’t match' },
  { id: 'no-account', label: 'Account not found' },
];

export const setNextOutcome = (outcome) => save({ ...load(), nextOutcome: outcome });

// A coach who hasn't added a bank account yet
export const startWithNoBank = () => save({ ...NONE });

// Back to the demo's verified HDFC account
export const resetToDemoBank = () => save({ ...DEMO });

// Ends a check now (the account's, or a change's), as its outcome says
export function finishCheckNow(now = Date.now()) {
  const s = load();
  if (s.pending) return save({ ...s, pending: { ...s.pending, submittedAt: now - CHECK_MS } });
  if (s.status !== 'checking') return false;
  return save({ ...s, submittedAt: now - CHECK_MS });
}