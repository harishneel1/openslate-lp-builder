import { useEffect, useState } from 'react';
import { mockAccount } from './myPage';

// ------------------------------------------------------------
// The coach's business, as Meta will verify it for WhatsApp. Collected in
// Settings → WhatsApp before Meta's sign-up window (WhatsAppBusinessForm.jsx),
// because no WhatsApp message can go out until Meta has verified the
// business. Our WhatsApp partner (AiSensy) gets the same values through
// its verification API, and they must match what Meta's window was given,
// so we collect them once, here, and use them for both.
//
// A fresh step of its own: nothing comes from Payment details. What our
// payment partner verified (KYC, bank, invoice address) may not be what
// Meta needs, and the coach may be paid as one thing and verify another.
//
// Asked in this order:
//   1. What kind of business are you?  (BUSINESS_TYPES)
//      An individual with no registration can't connect: Meta verifies
//      businesses, not people. They're told to get GST or MSME first.
//   2. One document, from the ones that fit that type (DOCS_FOR). AiSensy
//      accepts GST, MSME (Udyam), Incorporation Certificate or a current
//      account statement (not savings). Utility bills are left out for now.
//   3. The legal name, exactly as on that document
//   4. The registered address
//
// Kept in this browser (localStorage) under KEY, whatever is typed, as it's
// typed, so leaving and coming back keeps it:
//   {
//     type: 'company' | 'llp' | 'partnership' | 'proprietor' | 'individual' | null,
//     docType: one of DOCUMENTS' ids, or null
//     doc: { name, kind: 'image' | 'pdf', size, preview } or null
//          (preview: a small JPEG data URL for photos, null for PDFs.
//           The real product uploads the file to storage.)
//     legalName: '',
//     address: { line1, area, city, state, pin },  India only for now
//     website: '',                only asked for when Meta says the
//                                 website doesn't match (the fix panel)
//     status: 'draft' | 'sent',   sent: went with a finished setup (locked)
//     sentAt: ISO string or null,
//     verification: null | 'PENDING' | 'APPROVED' | 'FAILED' | 'DISCARDED' | 'REVOKED'
//                   Meta's check of the business, once sent, in Meta's own
//                   values (see "Meta's check" below)
//     rejectionReasons: [],       Meta's reasons, for FAILED or REVOKED
//                                 (REJECTION_REASONS' ids; never 'NONE')
//     reviewEndsAt: ISO string,   stand-in for Meta's check: approved once
//                                 this has passed (settleVerification)
//     decidedAt: ISO string or null,
//     attempts: 1,                times sent to Meta (1 + resubmits)
//   }
// Once sent it's read-only, except to fix what Meta turned down
// (resubmitBusiness). No WhatsApp message goes out until it's APPROVED
// (isSetUp in whatsappConnection.js). Separate from the WhatsApp
// connection (whatsappConnection.js): it exists before a number is
// connected and stays after a disconnect.
//
// ------------------------------------------------------------

const KEY = 'pagebuilder:whatsapp-business';
export const BUSINESS_CHANGED_EVENT = 'whatsapp-business-changed';

// The largest document, and the files accepted (as for KYC)
export const DOC_MAX_MB = 5;
export const DOC_FILE_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

// ---------- What kind of business ----------
//   label   the choice
//   sub     a line under it, when the label isn't enough
//   named   how the legal name is written for this type, for its hint
export const BUSINESS_TYPES = [
  { id: 'company', label: 'Private limited company', sub: 'Registered with the MCA', named: 'including “Private Limited”' },
  { id: 'llp', label: 'LLP', sub: 'Limited liability partnership', named: 'including “LLP”' },
  { id: 'partnership', label: 'Partnership firm', sub: 'With a partnership deed', named: null },
  { id: 'proprietor', label: 'Sole proprietor', sub: 'A business registered in your own name', named: null },
  { id: 'individual', label: 'Individual', sub: 'No business registration', named: null },
];

export const businessTypeOf = (id) => BUSINESS_TYPES.find((t) => t.id === id) ?? null;

// ---------- The documents ----------
// The documents AiSensy accepts for verification, and no others. A utility
// bill is accepted too but left out for now: it confused coaches.
//   label     the choice, and in lists
//   sentence  how it reads inside a sentence, when that differs
//   on        "as on …", for the legal name's and the address's hints
//   note      under the choice, when the document has a catch
export const DOCUMENTS = {
  incorporation: { label: 'Incorporation Certificate', on: 'your Incorporation Certificate' },
  gst: { label: 'GST certificate', on: 'your GST certificate' },
  msme: { label: 'MSME (Udyam) certificate', on: 'your MSME (Udyam) certificate' },
  // A current account's, not a savings account's: AiSensy doesn't accept those
  bank: {
    label: 'Current account statement',
    sentence: 'current account statement',
    on: 'your current account statement',
    note: 'From your business current account, showing your business name and address. Savings account statements aren’t accepted.',
  },
};

// Which documents each type can use, the most common first. An
// individual has none of them: they need GST or MSME first.
export const DOCS_FOR = {
  company: ['incorporation', 'gst', 'msme', 'bank'],
  llp: ['incorporation', 'gst', 'msme', 'bank'],
  partnership: ['gst', 'msme', 'bank'],
  proprietor: ['gst', 'msme', 'bank'],
  individual: [],
};

export const docsFor = (type) => DOCS_FOR[type] ?? [];

// "GST certificate, MSME (Udyam) certificate or current account statement"
export function docsSentence(type) {
  const labels = docsFor(type).map((id) => DOCUMENTS[id].sentence ?? DOCUMENTS[id].label);
  if (labels.length < 2) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} or ${labels[labels.length - 1]}`;
}

// What an individual can get first, so they have a document
export const GET_REGISTERED = [
  {
    label: 'GST registration',
    text: 'If you already charge GST, or expect to.',
    href: 'https://reg.gst.gov.in/registration/',
  },
  {
    label: 'MSME (Udyam) registration',
    text: 'Free and online, usually done the same day.',
    href: 'https://udyamregistration.gov.in/',
  },
];

// ---------- Hints that name the chosen document ----------

// Under the legal name: "Exactly as on your GST certificate."
export function legalNameHint(record) {
  const doc = DOCUMENTS[record.docType];
  const named = businessTypeOf(record.type)?.named;
  if (!doc) return 'Exactly as on your document.';
  return named ? `Exactly as on ${doc.on}, ${named}.` : `Exactly as on ${doc.on}.`;
}

// Above the address
export function addressHint(record) {
  const doc = DOCUMENTS[record.docType];
  return doc ? `Exactly as on ${doc.on}.` : 'Your registered address, as on your document.';
}

// ---------- States and union territories, for the address ----------
export const STATES = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
];

export const COUNTRY = 'India';

// ---------- Saved ----------

const EMPTY_ADDRESS = { line1: '', area: '', city: '', state: '', pin: '' };

export const EMPTY_BUSINESS = {
  type: null,
  docType: null,
  doc: null,
  legalName: '',
  address: EMPTY_ADDRESS,
  website: '',
  status: 'draft',
  sentAt: null,
  verification: null,
  rejectionReasons: [],
  reviewEndsAt: null,
  decidedAt: null,
  attempts: 0,
};

// How long the stand-in's verification takes. Meta's real one usually
// takes a few days.
const VERIFY_MS = 30 * 1000;

// ---------- Meta's check, in Meta's own values ----------
// Meta tells its partner (AiSensy) through its webhook, which we assume
// AiSensy passes through as it is (to confirm with AiSensy):
//
//   { "field": "account_update",
//     "value": { "event": "PARTNER_CLIENT_CERTIFICATION_STATUS_UPDATE",
//                "partner_client_certification_info": {
//                  "client_business_id": "2729063490586005",
//                  "status": "FAILED",
//                  "rejection_reasons": ["ADDRESS_NOT_MATCHING"] } } }
//
// status, and what the coach sees:
//   PENDING    In review. Nothing to do.
//   APPROVED   Verified: WhatsApp can go live. (rejection_reasons: NONE)
//   FAILED     Not verified, with Meta's reasons. Fix and resubmit.
//   DISCARDED  Meta closed the request without a decision. Send again.
//   REVOKED    Verified before, now withdrawn: WhatsApp stops. Fix and
//              resubmit (with Meta's reasons when it gives any).
// Meta has no "more information needed": an unreadable document comes
// back as FAILED with MALFORMED_DOCUMENTS.
export const META_STATUSES = ['PENDING', 'APPROVED', 'FAILED', 'DISCARDED', 'REVOKED'];

// Meta's rejection reasons, each in plain words, with what to fix.
//   label  short, for the prototype controls
//   fixes  the parts of the details it points at: 'legalName',
//          'address', 'doc', 'website'. A new document can fix any of
//          the first three.
//   text(record)  what went wrong, naming their document
//   fix(record)   what to do about it
// BUSINESS_NOT_ELIGIBLE can't be fixed by changing the details.
const docOn = (r) => DOCUMENTS[r.docType]?.on ?? 'your document';
export const REJECTION_REASONS = {
  LEGAL_NAME_NOT_MATCHING: {
    label: 'Name doesn’t match',
    fixes: ['legalName'],
    text: (r) => `The name on ${docOn(r)} doesn’t match the legal name you entered, “${r.legalName}”.`,
    fix: () => 'Change the legal name to match your document exactly, or upload a document that shows this name.',
  },
  LEGAL_NAME_NOT_FOUND_IN_DOCUMENTS: {
    label: 'Name not on document',
    fixes: ['doc'],
    text: (r) => `Meta couldn’t find your legal name, “${r.legalName}”, on ${docOn(r)}.`,
    fix: () => 'Upload a document that shows your legal business name clearly.',
  },
  ADDRESS_NOT_MATCHING: {
    label: 'Address doesn’t match',
    fixes: ['address'],
    text: (r) => `The address on ${docOn(r)} doesn’t match the address you entered.`,
    fix: () => 'Change the address to match your document, word for word, or upload a document that shows this address.',
  },
  MALFORMED_DOCUMENTS: {
    label: 'Document unreadable',
    fixes: ['doc'],
    text: (r) => `Meta couldn’t read ${docOn(r)}. It may be blurry, cut off, password-protected or out of date.`,
    fix: () => 'Upload a clear copy of the whole page, or another accepted document.',
  },
  WEBSITE_NOT_MATCHING: {
    label: 'Website doesn’t match',
    fixes: ['website'],
    text: (r) => `Meta couldn’t match your website to “${r.legalName}”.`,
    fix: () => 'Add a working website that shows your legal business name. Your Open Slate page works if it shows it.',
  },
  BUSINESS_NOT_ELIGIBLE: {
    label: 'Not eligible',
    fixes: [],
    text: () => 'Meta says your business can’t use WhatsApp Business under its Commerce Policy.',
    fix: () => 'This can’t be fixed by changing your details. If you think it’s a mistake, contact us and we’ll ask Meta to look again.',
  },
};

// Where to read Meta's policy, for BUSINESS_NOT_ELIGIBLE
export const META_COMMERCE_POLICY_URL = 'https://www.whatsapp.com/legal/commerce-policy';
// TODO: our support link
export const SUPPORT_URL = '#';

// A saved verification. Older saves used our own words: read as Meta's.
// Sent before verification was tracked: in review.
const OLDER = { review: 'PENDING', verified: 'APPROVED', 'needs-info': 'FAILED' };
const verificationOf = (v) => (META_STATUSES.includes(v) ? v : (OLDER[v] ?? 'PENDING'));

const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);
const text = (v) => (typeof v === 'string' ? v : '');

// The saved details, or an empty draft. Anything malformed is dropped.
export function loadBusiness() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (!isObject(s)) return EMPTY_BUSINESS;
    const type = businessTypeOf(s.type) ? s.type : null;
    const docType = type && docsFor(type).includes(s.docType) ? s.docType : null;
    const a = isObject(s.address) ? s.address : {};
    return {
      type,
      docType,
      doc: docType && isObject(s.doc) && typeof s.doc.name === 'string' ? s.doc : null,
      legalName: text(s.legalName),
      address: {
        line1: text(a.line1),
        area: text(a.area),
        city: text(a.city),
        state: STATES.includes(a.state) ? a.state : '',
        pin: text(a.pin),
      },
      website: text(s.website),
      status: s.status === 'sent' ? 'sent' : 'draft',
      sentAt: typeof s.sentAt === 'string' ? s.sentAt : null,
      verification: s.status === 'sent' ? verificationOf(s.verification) : null,
      rejectionReasons: s.verification === 'needs-info'
        ? ['MALFORMED_DOCUMENTS']
        : Array.isArray(s.rejectionReasons) ? s.rejectionReasons.filter((id) => REJECTION_REASONS[id]) : [],
      reviewEndsAt: typeof s.reviewEndsAt === 'string' ? s.reviewEndsAt : null,
      decidedAt: typeof s.decidedAt === 'string' ? s.decidedAt : null,
      attempts: Number.isInteger(s.attempts) ? s.attempts : s.status === 'sent' ? 1 : 0,
    };
  } catch {
    return EMPTY_BUSINESS;
  }
}

// true when saved. A full photo can be too big for this browser's storage.
// Also fires the WhatsApp connection's own event ('whatsapp-changed',
// WHATSAPP_CHANGED_EVENT in whatsappConnection.js), since whether WhatsApp
// can send depends on verification: every place following the connection
// (Reminders tabs, booking messages) follows this too.
const WHATSAPP_CHANGED = 'whatsapp-changed';

function saveBusiness(record) {
  try {
    localStorage.setItem(KEY, JSON.stringify(record));
    window.dispatchEvent(new Event(BUSINESS_CHANGED_EVENT));
    window.dispatchEvent(new Event(WHATSAPP_CHANGED));
    return true;
  } catch {
    return false;
  }
}

function clearBusiness() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // fine: nothing was saved
  }
  window.dispatchEvent(new Event(BUSINESS_CHANGED_EVENT));
  window.dispatchEvent(new Event(WHATSAPP_CHANGED));
}

// What changes when a field does, as the coach types. Locked once sent.
// Choosing another business type drops a document that doesn't fit it.
// Returns { saved, dropped }: dropped is the document's label when one
// was taken off, so the form can say so.
export function editBusiness(changes) {
  const current = loadBusiness();
  if (current.status === 'sent') return { saved: false, dropped: null };
  const { next, dropped } = applyEdit(current, changes);
  return { saved: saveBusiness(next), dropped };
}

// One change to a record, without saving it: editBusiness, and the fix
// panel's own copy before it's resubmitted. Choosing another business
// type drops a document that doesn't fit it; another kind of document
// drops the file picked for the last one.
export function applyEdit(current, changes) {
  const next = { ...current, ...changes, address: { ...current.address, ...(changes.address ?? {}) } };
  let dropped = null;
  if ('type' in changes && next.docType && !docsFor(next.type).includes(next.docType)) {
    dropped = DOCUMENTS[next.docType].label;
    next.docType = null;
    next.doc = null;
  }
  if ('docType' in changes && changes.docType !== current.docType) next.doc = null;
  return { next, dropped };
}

const inReview = (now = Date.now()) => ({
  verification: 'PENDING',
  rejectionReasons: [],
  reviewEndsAt: new Date(now + VERIFY_MS).toISOString(),
  decidedAt: null,
});

// Setup finished: the details went with it, to Meta and to AiSensy, and
// Meta starts checking them
export function markBusinessSent() {
  const current = loadBusiness();
  if (current.status === 'sent') return;
  saveBusiness({ ...current, status: 'sent', sentAt: new Date().toISOString(), attempts: 1, ...inReview() });
}

// ---------- Meta's check ----------

export const isVerified = (record) => record?.verification === 'APPROVED';
export const inMetaReview = (record) => record?.verification === 'PENDING';

// Meta turned it down (or withdrew it, or closed it): something to do
export const needsFix = (record) => ['FAILED', 'DISCARDED', 'REVOKED'].includes(record?.verification);

// Turned down for a reason no change of details fixes
export const notEligible = (record) => needsFix(record) && record.rejectionReasons.includes('BUSINESS_NOT_ELIGIBLE');

// Can go back to Meta: anything turned down, unless it's not eligible
export const canResubmit = (record) => needsFix(record) && !notEligible(record);

// The parts of the details Meta's reasons point at, as a set
export function flaggedParts(record) {
  const parts = new Set();
  for (const id of record.rejectionReasons ?? []) for (const f of REJECTION_REASONS[id]?.fixes ?? []) parts.add(f);
  return parts;
}

const sameAddress = (a, b) =>
  ['line1', 'area', 'city', 'state', 'pin'].every((k) => String(a[k] ?? '').trim() === String(b[k] ?? '').trim());
const sameDoc = (a, b) => a?.name === b?.name && a?.size === b?.size && a?.preview === b?.preview;

// What still stops a fix going back to Meta ({ part: message }): every
// part Meta flagged has to change (a new document counts for the name and
// the address too), and nothing can be missing. Empty when it can go.
//   sent: the details as Meta saw them   draft: as the coach has fixed them
export function fixProblems(sent, draft) {
  const p = { ...businessProblems(draft) };
  const flagged = flaggedParts(sent);
  const newDoc = !sameDoc(sent.doc, draft.doc) || sent.docType !== draft.docType;
  if (flagged.has('doc') && !newDoc && !p.doc) p.doc = 'Upload a new document. Meta couldn’t use this one.';
  if (flagged.has('legalName') && !newDoc && draft.legalName.trim() === sent.legalName.trim() && !p.legalName) {
    p.legalName = 'Change the name to match your document, or upload a different document.';
  }
  if (flagged.has('address') && !newDoc && sameAddress(sent.address, draft.address) && !p.line1) {
    p.line1 = 'Change the address to match your document, or upload a different document.';
  }
  if (flagged.has('website')) {
    const w = draft.website.trim();
    if (!w) p.website = 'Enter your website.';
    else if (!/^(https?:\/\/)?[^\s.]+\.[^\s]{2,}$/i.test(w)) p.website = 'Enter a website address, like coachname.com.';
    else if (w === sent.website.trim()) p.website = 'Meta couldn’t match this one. Enter a website that shows your legal name.';
  }
  return p;
}

// The fixed details, back to Meta (through AiSensy) for another check.
// Returns true if saved. The business type can't change here.
// To confirm with AiSensy: that a resubmit also updates the name and
// address on the coach's Meta business, so the two still match.
export function resubmitBusiness(draft) {
  const current = loadBusiness();
  if (!canResubmit(current)) return false;
  if (Object.keys(fixProblems(current, draft)).length) return false;
  return saveBusiness({
    ...current,
    docType: draft.docType,
    doc: draft.doc,
    legalName: draft.legalName.trim(),
    address: draft.address,
    website: draft.website.trim(),
    attempts: current.attempts + 1,
    ...inReview(),
  });
}

// Meta's webhook, as AiSensy passes it on (see "Meta's check" above):
// the "value" of an account_update. Anything else is ignored.
// Returns true if it changed the record.
export function applyCertificationUpdate(value, now = Date.now()) {
  if (value?.event !== 'PARTNER_CLIENT_CERTIFICATION_STATUS_UPDATE') return false;
  const info = value.partner_client_certification_info ?? {};
  if (!META_STATUSES.includes(info.status)) return false;
  const r = loadBusiness();
  if (r.status !== 'sent') return false;
  const reasons = (info.rejection_reasons ?? []).filter((id) => REJECTION_REASONS[id]);
  return saveBusiness({
    ...r,
    verification: info.status,
    rejectionReasons: ['FAILED', 'REVOKED'].includes(info.status) ? reasons : [],
    reviewEndsAt: info.status === 'PENDING' ? r.reviewEndsAt : null,
    decidedAt: info.status === 'PENDING' ? null : new Date(now).toISOString(),
  });
}

// What Meta's webhook would say: for the stand-in and Prototype controls
export const certificationUpdate = (status, reasons = []) => ({
  event: 'PARTNER_CLIENT_CERTIFICATION_STATUS_UPDATE',
  partner_client_certification_info: {
    client_business_id: '2729063490586005',
    status,
    rejection_reasons: reasons.length ? reasons : ['NONE'],
  },
});

// The stand-in's check finishing: approved once its time has passed.
// The real product hears this from AiSensy instead.
export function settleVerification(now = Date.now()) {
  const r = loadBusiness();
  if (r.verification !== 'PENDING') return;
  if (r.reviewEndsAt && now < Date.parse(r.reviewEndsAt)) return;
  applyCertificationUpdate(certificationUpdate('APPROVED'), now);
}

// ---------- Checking ----------

const digitsOf = (v) => String(v ?? '').replace(/\D/g, '');

// A 6-digit PIN code, not starting with 0
export function pinProblem(pin) {
  const d = digitsOf(pin);
  if (!d) return 'Enter the PIN code.';
  if (d.length !== 6 || d.startsWith('0')) return 'Enter a 6-digit PIN code.';
  return null;
}

// What's missing or wrong, field by field ({ field: message }), in the
// order the form shows them. Empty when it's ready to send.
export function businessProblems(r) {
  const p = {};
  if (!r.type) p.type = 'Choose what kind of business you are.';
  if (r.type === 'individual') return p; // can't connect: no form
  if (!r.docType) p.docType = 'Choose the document you’ll upload.';
  else if (!r.doc) p.doc = `Upload your ${DOCUMENTS[r.docType].label}.`;
  const name = r.legalName.trim();
  if (!name) p.legalName = 'Enter your legal business name.';
  else if (name.length < 3) p.legalName = 'Enter the full name, as on your document.';
  if (!r.address.line1.trim()) p.line1 = 'Enter the building and street.';
  if (!r.address.city.trim()) p.city = 'Enter the city.';
  if (!r.address.state) p.state = 'Choose the state.';
  const pin = pinProblem(r.address.pin);
  if (pin) p.pin = pin;
  return p;
}

// Ready to go with Connect: a business (not an individual), and nothing missing
export const businessReady = (r) =>
  Boolean(r.type) && r.type !== 'individual' && Object.keys(businessProblems(r)).length === 0;

// The address on one line: "7/4, 6th Street, Kodambakkam, Chennai, Tamil Nadu 600024, India"
export function addressLine(a) {
  const place = [a.state, digitsOf(a.pin)].filter(Boolean).join(' ');
  return [a.line1, a.area, a.city, place, COUNTRY].map((s) => String(s ?? '').trim()).filter(Boolean).join(', ');
}

// ---------- Kept up to date ----------

export function useBusiness() {
  const [record, setRecord] = useState(loadBusiness);
  useEffect(() => {
    const refresh = () => setRecord(loadBusiness());
    window.addEventListener(BUSINESS_CHANGED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(BUSINESS_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  // While Meta is checking, see every second whether the stand-in is done
  const checking = record.verification === 'PENDING';
  useEffect(() => {
    if (!checking) return undefined;
    settleVerification();
    const id = setInterval(() => settleVerification(), 1000);
    return () => clearInterval(id);
  }, [checking]);
  return record;
}

// ---------- Prototype controls ----------

// A sole proprietor with a GST certificate, every field filled in
export const SAMPLE_BUSINESS = {
  type: 'proprietor',
  docType: 'gst',
  doc: { name: 'gst-certificate.pdf', kind: 'pdf', size: 248000, preview: null },
  legalName: `${mockAccount.name} Coaching`,
  address: {
    line1: '7/4, 6th Street, 1st Cross',
    area: 'Dr. Subbarayan Nagar, Kodambakkam',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pin: '600024',
  },
};

export const businessDemo = {
  // Nothing typed yet
  empty: () => clearBusiness(),
  // Every field filled in. sent: as it would be after a finished setup.
  fill: (sent = false) =>
    saveBusiness({
      ...EMPTY_BUSINESS,
      ...SAMPLE_BUSINESS,
      ...(sent ? { status: 'sent', sentAt: new Date().toISOString(), attempts: 1, ...inReview() } : {}),
    }),
  // Meta's check, set directly (once the details are sent), as Meta's
  // webhook would: a status, and for FAILED or REVOKED its reasons.
  // PENDING starts the stand-in's wait again.
  setVerification: (status, reasons = []) => {
    const r = loadBusiness();
    if (r.status !== 'sent') return;
    if (status === 'PENDING') saveBusiness({ ...r, ...inReview() });
    else applyCertificationUpdate(certificationUpdate(status, reasons));
  },
  // For the Connected shortcut: the sample, unless they've filled their own
  fillIfNotReady: () => {
    const r = loadBusiness();
    if (businessReady(r)) markBusinessSent();
    else businessDemo.fill(true);
  },
};
