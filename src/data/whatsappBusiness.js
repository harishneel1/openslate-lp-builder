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
//     status: 'draft' | 'sent',   sent: went with a finished setup (locked)
//     sentAt: ISO string or null,
//   }
// Once sent it's read-only. Round 3 reopens it when Meta asks for more or
// rejects it. Separate from the WhatsApp connection (whatsappConnection.js):
// it exists before a number is connected and stays after a disconnect.
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
  status: 'draft',
  sentAt: null,
};

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
      status: s.status === 'sent' ? 'sent' : 'draft',
      sentAt: typeof s.sentAt === 'string' ? s.sentAt : null,
    };
  } catch {
    return EMPTY_BUSINESS;
  }
}

// true when saved. A full photo can be too big for this browser's storage.
function saveBusiness(record) {
  try {
    localStorage.setItem(KEY, JSON.stringify(record));
    window.dispatchEvent(new Event(BUSINESS_CHANGED_EVENT));
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
}

// What changes when a field does, as the coach types. Locked once sent.
// Choosing another business type drops a document that doesn't fit it.
// Returns { saved, dropped }: dropped is the document's label when one
// was taken off, so the form can say so.
export function editBusiness(changes) {
  const current = loadBusiness();
  if (current.status === 'sent') return { saved: false, dropped: null };
  const next = { ...current, ...changes, address: { ...current.address, ...(changes.address ?? {}) } };
  let dropped = null;
  if ('type' in changes && next.docType && !docsFor(next.type).includes(next.docType)) {
    dropped = DOCUMENTS[next.docType].label;
    next.docType = null;
    next.doc = null;
  }
  // A different kind of document: the file picked for the last one goes
  if ('docType' in changes && changes.docType !== current.docType) next.doc = null;
  return { saved: saveBusiness(next), dropped };
}

// Setup finished: the details went with it, to Meta and to AiSensy
export function markBusinessSent() {
  const current = loadBusiness();
  if (current.status === 'sent') return;
  saveBusiness({ ...current, status: 'sent', sentAt: new Date().toISOString() });
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
      ...SAMPLE_BUSINESS,
      status: sent ? 'sent' : 'draft',
      sentAt: sent ? new Date().toISOString() : null,
    }),
  // For the Connected shortcut: the sample, unless they've filled their own
  fillIfNotReady: () => {
    const r = loadBusiness();
    if (businessReady(r)) markBusinessSent();
    else businessDemo.fill(true);
  },
};
