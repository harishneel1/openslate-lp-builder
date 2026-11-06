// ------------------------------------------------------------
// Payouts: who a coach is (KYC) and the bank account their money is
// withdrawn to (Settings → Payment details, screens/SettingsPage.jsx,
// PayoutSetup.jsx and IdentitySetup.jsx).
//
// Two parts, each checked on its own; withdrawing needs both verified:
//
//   Identity (kyc)  how they're paid, chosen once at the start:
//                   individual  their PAN and Aadhaar, a photo or PDF of each
//                   business    one of BUSINESS_TYPES: the business (its PAN
//                               and registration certificate; a
//                               proprietorship gives its name and a proof
//                               instead), the person signing for it (PAN
//                               and Aadhaar), and GST if registered
//                   Our payment partner checks them against government
//                   records: in real life a few hours, sometimes a person
//                   looks at the documents.
//   Bank (account)  IFSC, account number, the name on it. Checked by
//                   sending ₹1 ("penny drop") to make sure it exists and
//                   is in the payee's name (payeeOf: the person, or the
//                   business), so it can be added once identity is sent.
//
// Until both pass the coach can still sell: their money waits in the
// wallet. The prototype pretends each check takes KYC_CHECK_MS or
// CHECK_MS and ends however Prototype controls say (next).
//
// Each part's status:
//   none       not given yet
//   checking   sent for checking (submittedAt)
//   needs-fix  the check found a problem. Identity: problems, a list of
//              { doc: 'pan' | 'aadhaar', part: 'number' | 'file', message },
//              so the setup opens on the document to fix and keeps the
//              rest. doc is one of DOCS. Bank: problem, { field, message }.
//   verified   done (verifiedAt)
//
// Changing a verified bank account (submitBankChange): the new one is
// checked as a pending change, and withdrawals keep going to the old one
// until it passes. If it needs a fix, the old one still works; the change
// can be fixed or cancelled.
//   pending: { status: 'checking' | 'needs-fix', bank, problem, submittedAt }
// Verified identity can't be changed here (support does it).
//
// Kept in this browser (localStorage) under KEY:
//   { kyc: { status, type: 'individual' | 'business', businessType,
//            business: { pan, name }, pan, panName, aadhaar, gstin,
//            docs: { pan, aadhaar, businessPan, certificate, gst },
//            submittedAt, verifiedAt, outcome },
//     (pan, panName, aadhaar: the person, the coach or the one signing
//      for the business; business.name: as registered, from its PAN, or
//      as they typed it for a proprietorship; gstin: '' when not registered)
//     account: { status, bank: { account, ifsc, bankName, branch, holder },
//                submittedAt, verifiedAt, changedAt, outcome,
//                pending: { status, bank, submittedAt, outcome } or null },
//     next: { kyc, bank } }
//   a document: { name, kind: 'image' | 'pdf', size, preview } (preview: a
//     small JPEG data URL for photos, null for PDFs and the demo's)
//   outcome: how that check ends; next: how the next one will end
// With nothing saved, the demo coach is fully verified: HDFC Bank ••4521,
// the one the demo history's withdrawals went to.
// (The key changed from 'pagebuilder:payouts' when identity became its own
// part; the old one is ignored and the demo starts verified.)
// ------------------------------------------------------------

const KEY = 'pagebuilder:payouts-v2';
const CHANGED_EVENT = 'payouts-changed';

// How long the checks take in the prototype. Real bank checks take
// seconds to a few hours; identity checks usually a few hours.
export const CHECK_MS = 8000;
export const KYC_CHECK_MS = 12000;

// The largest document we accept, and the kinds
export const DOC_MAX_MB = 5;
export const DOC_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

const NO_DOCS = { pan: null, aadhaar: null, businessPan: null, certificate: null, gst: null };

const DEMO = {
  kyc: {
    status: 'verified',
    type: 'individual',
    businessType: null,
    business: { pan: '', name: '' },
    pan: 'ABCPN1234F',
    panName: 'HARISH NEEL',
    aadhaar: '734291680537',
    gstin: '',
    docs: {
      ...NO_DOCS,
      pan: { name: 'pan-card.jpg', kind: 'image', size: 412000, preview: null },
      aadhaar: { name: 'aadhaar-front.jpg', kind: 'image', size: 538000, preview: null },
    },
    submittedAt: null,
    verifiedAt: null,
    outcome: 'approve',
  },
  account: {
    status: 'verified',
    bank: {
      account: '50100234564521',
      ifsc: 'HDFC0001234',
      bankName: 'HDFC Bank',
      branch: 'Kodambakkam, Chennai',
      holder: 'Harish Neel',
    },
    submittedAt: null,
    verifiedAt: null,
    changedAt: null,
    outcome: 'approve',
    pending: null,
  },
  next: { kyc: 'approve', bank: 'approve' },
};

const NONE = {
  kyc: {
    status: 'none',
    type: 'individual',
    businessType: null,
    business: { pan: '', name: '' },
    pan: '',
    panName: '',
    aadhaar: '',
    gstin: '',
    docs: { ...NO_DOCS },
    submittedAt: null,
    verifiedAt: null,
    outcome: 'approve',
  },
  account: {
    status: 'none',
    bank: null,
    submittedAt: null,
    verifiedAt: null,
    changedAt: null,
    outcome: 'approve',
    pending: null,
  },
  next: { kyc: 'approve', bank: 'approve' },
};

const copy = (s) => JSON.parse(JSON.stringify(s));

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!saved || typeof saved !== 'object' || !saved.kyc || !saved.account) return copy(DEMO);
    return {
      kyc: {
        ...NONE.kyc,
        ...saved.kyc,
        business: { ...NONE.kyc.business, ...saved.kyc.business },
        docs: { ...NO_DOCS, ...saved.kyc.docs },
      },
      account: { ...NONE.account, ...saved.account },
      next: { ...NONE.next, ...saved.next },
    };
  } catch {
    return copy(DEMO);
  }
}

// false when it couldn't be saved (usually: the browser's storage is full)
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

// ---------- Who's being paid ----------

// 'HN LEARNING PRIVATE LIMITED' → 'HN Learning Private Limited': words
// with no vowels (HN, LLP) stay in capitals
export const nameCase = (name) =>
  String(name ?? '').replace(/[A-Za-z]+/g, (w) =>
    /[aeiou]/i.test(w) ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toUpperCase(),
  );

// What a business can be, and what each one asks for.
//   panLetter   the 4th letter of its PAN (C company, F firm or LLP);
//               null: a proprietorship has no PAN of its own
//   certificate what proves it's registered
//   signer      the person who signs for it
export const BUSINESS_TYPES = [
  {
    id: 'proprietorship',
    label: 'Proprietorship',
    as: 'a proprietorship',
    panLetter: null,
    certificate: 'GST certificate or Udyam registration',
    certificateShort: 'Business proof',
    signer: 'owner',
  },
  {
    id: 'partnership',
    label: 'Partnership',
    as: 'a partnership firm',
    panLetter: 'F',
    certificate: 'partnership deed',
    certificateShort: 'Partnership deed',
    signer: 'partner',
  },
  {
    id: 'private_limited',
    label: 'Private Limited',
    as: 'a private limited company',
    panLetter: 'C',
    certificate: 'Certificate of Incorporation',
    certificateShort: 'Certificate of Incorporation',
    signer: 'director',
  },
  {
    id: 'llp',
    label: 'LLP',
    as: 'an LLP',
    panLetter: 'F',
    certificate: 'LLP incorporation certificate',
    certificateShort: 'LLP certificate',
    signer: 'designated partner',
  },
];

export const businessTypeOf = (id) => BUSINESS_TYPES.find((t) => t.id === id) ?? null;

// The documents, and what each is called for this coach:
// 'pan' → 'director’s PAN card' for a company, 'PAN card' for an individual
export const DOCS = ['businessPan', 'certificate', 'pan', 'aadhaar', 'gst'];

export function docLabelOf(doc, kyc) {
  const bt = kyc.type === 'business' ? businessTypeOf(kyc.businessType) : null;
  const whose = bt ? `${bt.signer}’s ` : '';
  if (doc === 'pan') return `${whose}PAN card`;
  if (doc === 'aadhaar') return `${whose}Aadhaar card`;
  if (doc === 'businessPan') return 'business PAN card';
  if (doc === 'certificate') return bt?.certificate ?? 'certificate';
  if (doc === 'gst') return 'GST certificate';
  return 'document';
}

// The documents this coach sends, in order
export const docsFor = (kyc) =>
  kyc.type !== 'business'
    ? ['pan', 'aadhaar']
    : [
        ...(businessTypeOf(kyc.businessType)?.panLetter ? ['businessPan'] : []),
        'certificate',
        'pan',
        'aadhaar',
        ...(kyc.gstin ? ['gst'] : []),
      ];

// Whose name the bank account must be in: { name, also }. A
// proprietorship's account can be in the business's name or the owner's
// (also). Names as registered, in capitals.
export function payeeOf(kyc) {
  if (kyc.type !== 'business') return { name: kyc.panName, also: null };
  if (kyc.businessType === 'proprietorship') return { name: kyc.business.name.toUpperCase(), also: kyc.panName };
  return { name: kyc.business.name, also: null };
}

// ---------- The state now ----------

// What's saved, with checks that have run their time ended as their
// outcome says. A bank change that passes becomes the account.
function settle(s, now) {
  let { kyc, account } = s;

  if (kyc.status === 'checking' && Number.isFinite(kyc.submittedAt) && now >= kyc.submittedAt + KYC_CHECK_MS) {
    kyc =
      kyc.outcome === 'approve'
        ? { ...kyc, status: 'verified', verifiedAt: kyc.submittedAt + KYC_CHECK_MS }
        : { ...kyc, status: 'needs-fix' };
  }

  if (account.status === 'checking' && Number.isFinite(account.submittedAt) && now >= account.submittedAt + CHECK_MS) {
    account =
      account.outcome === 'approve'
        ? { ...account, status: 'verified', verifiedAt: account.submittedAt + CHECK_MS }
        : { ...account, status: 'needs-fix' };
  }

  const p = account.pending;
  if (p && account.status !== 'verified') {
    account = { ...account, pending: null };
  } else if (p) {
    const done = p.submittedAt + CHECK_MS;
    if (now < done) account = { ...account, pending: { ...p, status: 'checking' } };
    else if (p.outcome === 'approve')
      account = { ...account, bank: p.bank, verifiedAt: done, changedAt: done, pending: null };
    else account = { ...account, pending: { ...p, status: 'needs-fix' } };
  }

  return { ...s, kyc, account };
}

// What an identity check that failed says, document by document
function kycProblemsOf(outcome, kyc) {
  const label = (doc) => docLabelOf(doc, kyc);
  if (outcome === 'pan-photo') {
    return [
      {
        doc: 'pan',
        part: 'file',
        message: `We couldn’t read the ${label('pan')} photo. Upload a sharp photo of the front, with all four corners in view.`,
      },
    ];
  }
  if (outcome === 'aadhaar-masked') {
    return [
      {
        doc: 'aadhaar',
        part: 'file',
        message: `The ${label('aadhaar')} photo shows a masked number. Upload one where all 12 digits are visible.`,
      },
    ];
  }
  if (outcome === 'aadhaar-name') {
    return [
      {
        doc: 'aadhaar',
        part: 'number',
        message: `The name on this Aadhaar doesn’t match the PAN (${kyc.panName}). Check the number is the right person’s.`,
      },
    ];
  }
  if (outcome === 'certificate-unclear') {
    return [
      {
        doc: 'certificate',
        part: 'file',
        message: `We couldn’t read your ${label('certificate')}. Upload a clear copy of every page, or the PDF you were given.`,
      },
    ];
  }
  if (outcome === 'gst-mismatch') {
    return [
      {
        doc: 'gst',
        part: 'number',
        message: `This GSTIN is registered to a different business, not ${kyc.business.name}. Check it against your GST certificate.`,
      },
    ];
  }
  return [];
}

// Outcomes that only make sense for some coaches; for others, the check passes
function applies(outcome, kyc) {
  if (outcome === 'certificate-unclear') return kyc.type === 'business';
  if (outcome === 'gst-mismatch') return kyc.type === 'business' && Boolean(kyc.gstin);
  return true;
}

// What a bank check that failed says, and where to fix it
function bankProblemOf(outcome, bank, payee) {
  if (outcome === 'name-mismatch') {
    return {
      field: 'holder',
      message: payee.also
        ? `The name on this bank account doesn’t match your business (${payee.name}) or your PAN (${payee.also}). Use an account in one of those names.`
        : `The name on this bank account doesn’t match ${payee.name}. Use an account in that name.`,
    };
  }
  if (outcome === 'no-account') {
    return {
      field: 'account',
      message: `We couldn’t find this account at ${bank?.bankName ?? 'your bank'}. Check the account number and IFSC.`,
    };
  }
  return null;
}

// { kyc: { ...saved, problems }, bank: { status, bank, problem, submittedAt,
//   verifiedAt, changedAt, pending }, ready, next }
// ready: both verified, so withdrawals can go out
export function payoutState(now = Date.now()) {
  const s = settle(load(), now);
  const { kyc, account } = s;
  const payee = payeeOf(kyc);
  const pending = account.pending
    ? {
        ...account.pending,
        problem:
          account.pending.status === 'needs-fix'
            ? bankProblemOf(account.pending.outcome, account.pending.bank, payee)
            : null,
      }
    : null;
  return {
    kyc: { ...kyc, problems: kyc.status === 'needs-fix' ? kycProblemsOf(kyc.outcome, kyc) : [] },
    bank: {
      ...account,
      problem: account.status === 'needs-fix' ? bankProblemOf(account.outcome, account.bank, payee) : null,
      pending,
    },
    ready: kyc.status === 'verified' && account.status === 'verified',
    next: s.next,
  };
}

// Who invoices are from, when the coach is paid as a verified business:
// { name, gstin, state } (gstin and state '' when not registered), or null for an
// individual or before the business is verified (invoices then keep the
// coach's own name, earnings.js's BUSINESS)
export function invoiceIdentity(now = Date.now()) {
  const { kyc } = payoutState(now);
  if (kyc.type !== 'business' || kyc.status !== 'verified') return null;
  return { name: nameCase(kyc.business.name), gstin: kyc.gstin, state: gstStateOf(kyc.gstin) };
}

// Where withdrawals go ({ name, last4, holder }), or null until identity
// and bank are both verified
export function verifiedBank(now = Date.now()) {
  const s = payoutState(now);
  if (!s.ready || !s.bank.bank) return null;
  const { bankName, account, holder } = s.bank.bank;
  return { name: bankName, last4: account.slice(-4), holder };
}

// ---------- Checking what they type ----------

// A personal PAN: 5 letters, 4 digits, 1 letter, and P 4th ("person")
export const cleanPan = (text) => String(text ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);

export function panProblem(pan) {
  if (!pan) return 'Enter your PAN.';
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) return 'A PAN looks like ABCPE1234F: 5 letters, 4 numbers, 1 letter.';
  if (pan[3] !== 'P') return 'This is a business PAN. For now, use your personal PAN (its 4th letter is P).';
  return null;
}

// The name a PAN is registered to. Made up in the prototype: every
// personal PAN belongs to the coach. The real product asks the
// government's records, through Razorpay or a KYC service.
export const panNameOf = (pan) => (panProblem(pan) ? '' : 'HARISH NEEL');

// A business's PAN: the same shape, with the 4th letter its type's
export function businessPanProblem(pan, typeId) {
  const bt = businessTypeOf(typeId);
  if (!pan) return 'Enter the business’s PAN.';
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) return 'A PAN looks like AAGCH4821K: 5 letters, 4 numbers, 1 letter.';
  if (pan[3] === 'P') return `This is a personal PAN. Enter ${bt.as}’s own PAN (its 4th letter is ${bt.panLetter}).`;
  if (pan[3] !== bt.panLetter) {
    return `This PAN isn’t ${bt.as}’s: its 4th letter should be ${bt.panLetter}. Check it, or the business type above.`;
  }
  return null;
}

// The name a business PAN is registered to. Made up in the prototype.
const MADE_UP_BUSINESS = {
  partnership: 'NEEL & ASSOCIATES',
  private_limited: 'HN LEARNING PRIVATE LIMITED',
  llp: 'HN LEARNING LLP',
};
export const businessPanNameOf = (pan, typeId) =>
  businessPanProblem(pan, typeId) ? '' : (MADE_UP_BUSINESS[typeId] ?? '');

// GSTIN: 15 characters. The state's code (2 digits), the PAN it was
// issued to, the registration's number, Z, then a check character that
// catches nearly every mistyped one.
export const cleanGstin = (text) => String(text ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);

const GST_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const gstCheckOk = (g) => {
  let sum = 0;
  for (let i = 0; i < 14; i += 1) {
    const n = GST_CHARS.indexOf(g[i]) * (i % 2 ? 2 : 1);
    sum += Math.floor(n / 36) + (n % 36);
  }
  return GST_CHARS[(36 - (sum % 36)) % 36] === g[14];
};

const GST_STATES = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
  10: 'Bihar', 11: 'Sikkim', 12: 'Arunachal Pradesh', 13: 'Nagaland', 14: 'Manipur', 15: 'Mizoram',
  16: 'Tripura', 17: 'Meghalaya', 18: 'Assam', 19: 'West Bengal', 20: 'Jharkhand', 21: 'Odisha',
  22: 'Chhattisgarh', 23: 'Madhya Pradesh', 24: 'Gujarat', 26: 'Dadra and Nagar Haveli and Daman and Diu',
  27: 'Maharashtra', 29: 'Karnataka', 30: 'Goa', 31: 'Lakshadweep', 32: 'Kerala', 33: 'Tamil Nadu',
  34: 'Puducherry', 35: 'Andaman and Nicobar Islands', 36: 'Telangana', 37: 'Andhra Pradesh',
  38: 'Ladakh',
};

// 'Tamil Nadu' for a GSTIN starting 33, or ''
export const gstStateOf = (gstin) => GST_STATES[String(gstin ?? '').slice(0, 2)] ?? '';

// pan: the PAN the GSTIN must carry (the business's, or a proprietor's own)
export function gstinProblem(gstin, pan) {
  if (!gstin) return 'Enter your GSTIN.';
  if (gstin.length < 15) return 'A GSTIN has 15 characters, like 33AAGCH4821K1ZM.';
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin) || !gstStateOf(gstin)) {
    return 'This isn’t a valid GSTIN. Check it against your GST certificate.';
  }
  if (!gstCheckOk(gstin)) return 'This GSTIN has a mistyped character. Check each one against your GST certificate.';
  if (pan && gstin.slice(2, 12) !== pan) {
    return `This GSTIN belongs to a different PAN. Yours should have ${pan} in it.`;
  }
  return null;
}

export function businessNameProblem(name) {
  if (!String(name ?? '').trim()) return 'Enter the business’s name.';
  return null;
}

// Aadhaar: 12 digits, never starting with 0 or 1, the last one a
// Verhoeff check digit, which catches nearly every mistyped digit
export const cleanAadhaar = (text) => String(text ?? '').replace(/\D/g, '').slice(0, 12);

// '734291680537' → '7342 9168 0537', as on the card
export const formatAadhaar = (digits) => String(digits ?? '').replace(/(\d{4})(?=\d)/g, '$1 ');

const VD = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const VP = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];
const verhoeffOk = (digits) =>
  [...digits].reverse().reduce((c, ch, i) => VD[c][VP[i % 8][Number(ch)]], 0) === 0;

export function aadhaarProblem(aadhaar) {
  if (!aadhaar) return 'Enter your Aadhaar number.';
  if (aadhaar.length < 12) return 'An Aadhaar number has 12 digits.';
  if (/^[01]/.test(aadhaar)) return 'An Aadhaar number doesn’t start with 0 or 1. Check it against your card.';
  if (!verhoeffOk(aadhaar)) return 'This isn’t a valid Aadhaar number. Check each digit against your card.';
  return null;
}

// What's missing about a document ({ name, kind, … } or null)
export const docProblem = (doc, what) => (doc ? null : `Upload a photo or PDF of your ${what}.`);

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

// '734291680537' → '•••• •••• 0537'
export const maskAadhaar = (aadhaar) => (aadhaar ? `•••• •••• ${aadhaar.slice(-4)}` : '');

// ---------- Changing it ----------

// Sends identity for checking (a first go, or a fix after a failed one).
// false when it couldn't be saved.
// details: { type, businessType, business: { pan, name }, pan, panName,
//   aadhaar, gstin, docs }
export function submitKyc(details, now = Date.now()) {
  const s = settle(load(), now);
  const business = details.type === 'business';
  const kyc = {
    ...s.kyc,
    status: 'checking',
    type: details.type,
    businessType: business ? details.businessType : null,
    business: business ? { pan: details.business.pan ?? '', name: details.business.name.trim() } : { pan: '', name: '' },
    pan: details.pan,
    panName: details.panName,
    aadhaar: details.aadhaar,
    gstin: business ? (details.gstin ?? '') : '',
    submittedAt: now,
    verifiedAt: null,
  };
  // Only the documents this coach sends are kept
  kyc.docs = Object.fromEntries(DOCS.map((d) => [d, docsFor(kyc).includes(d) ? (details.docs[d] ?? null) : null]));
  const outcome = s.next.kyc ?? 'approve';
  kyc.outcome = applies(outcome, kyc) ? outcome : 'approve';
  return save({
    ...s,
    kyc,
    // A fix after a failed check goes through, unless they choose otherwise
    next: { ...s.next, kyc: 'approve' },
  });
}

// Sends a bank account for checking (the first one, or a fix). Needs the
// PAN in, for the name check.
export function submitBank(bank, now = Date.now()) {
  const s = settle(load(), now);
  if (s.kyc.status === 'none') return false;
  return save({
    ...s,
    account: {
      ...s.account,
      status: 'checking',
      bank: { ...bank, ...lookupIfsc(bank.ifsc) },
      submittedAt: now,
      verifiedAt: null,
      changedAt: null,
      outcome: s.next.bank ?? 'approve',
      pending: null,
    },
    next: { ...s.next, bank: 'approve' },
  });
}

// Checks a new account for a verified one. Withdrawals keep going to the
// old one until the new one passes.
export function submitBankChange(bank, now = Date.now()) {
  const s = settle(load(), now);
  if (s.account.status !== 'verified') return false;
  return save({
    ...s,
    account: {
      ...s.account,
      pending: {
        status: 'checking',
        bank: { ...bank, ...lookupIfsc(bank.ifsc) },
        submittedAt: now,
        outcome: s.next.bank ?? 'approve',
      },
    },
    next: { ...s.next, bank: 'approve' },
  });
}

// Drops a change that's being checked or needs a fix; the old account stays
export function cancelBankChange(now = Date.now()) {
  const s = settle(load(), now);
  return save({ ...s, account: { ...s.account, pending: null } });
}

// ---------- Prototype controls (not part of the product) ----------

export const KYC_OUTCOMES = [
  { id: 'approve', label: 'Verified' },
  { id: 'pan-photo', label: 'PAN photo unclear' },
  { id: 'aadhaar-masked', label: 'Aadhaar masked' },
  { id: 'aadhaar-name', label: 'Aadhaar name doesn’t match' },
  { id: 'certificate-unclear', label: 'Certificate unclear (business)' },
  { id: 'gst-mismatch', label: 'GST doesn’t match (business)' },
];

export const BANK_OUTCOMES = [
  { id: 'approve', label: 'Verified' },
  { id: 'name-mismatch', label: 'Name doesn’t match' },
  { id: 'no-account', label: 'Account not found' },
];

// part: 'kyc' | 'bank'
export function setNextOutcome(part, outcome) {
  const s = load();
  return save({ ...s, next: { ...s.next, [part]: outcome } });
}

// A coach who hasn't started
export const startFresh = () => save(copy(NONE));

// Back to the demo's verified coach and HDFC account
export const resetToDemo = () => save(copy(DEMO));

// Ends every running check now, as its outcome says
export function finishChecksNow(now = Date.now()) {
  const s = load();
  const kyc = s.kyc.status === 'checking' ? { ...s.kyc, submittedAt: now - KYC_CHECK_MS } : s.kyc;
  let account = s.account.status === 'checking' ? { ...s.account, submittedAt: now - CHECK_MS } : s.account;
  if (account.pending?.status === 'checking') {
    account = { ...account, pending: { ...account.pending, submittedAt: now - CHECK_MS } };
  }
  return save({ ...s, kyc, account });
}