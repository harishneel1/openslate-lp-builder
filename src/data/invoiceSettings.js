// ------------------------------------------------------------
// Invoice settings: what goes on the invoices a coach's buyers get
// (Settings → Payment details → Your invoices, screens/InvoiceSettings.jsx;
// the invoice itself is screens/InvoicePage.jsx, through earnings.js's
// invoiceFrom).
//
//   send          email buyers an invoice with every purchase. Off: they
//                 aren't sent, though the coach can still download them
//                 from Sales → Transactions. (The prototype sends no email.)
//   displayName   the brand name at the top of the invoice
//   address, pin  the address under it
//   gstRegistered whether they're registered for GST. They say so here,
//                 like TagMango; nothing is assumed. No: invoices say GST
//                 isn't charged.
//   gstin         GST only: their GSTIN. Its state comes from its first
//                 two digits (gstStateOf), so there's no state to pick.
//   gstName       GST only: the name it's registered to (legal name)
//   regSame       GST only: the registered address is the one above
//   regAddress, regPin  GST only: the registered address, when it isn't
//   note          up to NOTE_MAX characters at the bottom of every invoice
//
// Kept in this browser (localStorage) under KEY. With nothing saved, the
// coach's own details: the ones the invoices used before this screen.
// ------------------------------------------------------------

import { gstStateOf, gstinProblem } from './payouts';

const KEY = 'pagebuilder:invoice-settings';
const CHANGED_EVENT = 'invoice-settings-changed';

export const NOTE_MAX = 500;

export const DEFAULT_INVOICE_SETTINGS = {
  send: true,
  displayName: 'Harish Neel',
  address: '7/4, 6th street, 1st cross, Dr. Subbarayan nagar, Kodambakkam, Chennai',
  pin: '600024',
  gstRegistered: false,
  gstin: '',
  gstName: '',
  regSame: true,
  regAddress: '',
  regPin: '',
  note: '',
};

export function loadInvoiceSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return saved && typeof saved === 'object'
      ? { ...DEFAULT_INVOICE_SETTINGS, ...saved }
      : { ...DEFAULT_INVOICE_SETTINGS };
  } catch {
    return { ...DEFAULT_INVOICE_SETTINGS };
  }
}

// false when it couldn't be saved
export function saveInvoiceSettings(next) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...DEFAULT_INVOICE_SETTINGS, ...next }));
    window.dispatchEvent(new Event(CHANGED_EVENT));
    return true;
  } catch {
    return false;
  }
}

// A change here or in another tab. Returns the unsubscribe.
export function onInvoiceSettingsChange(callback) {
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

// Back to the coach's own details (Prototype controls)
export const resetInvoiceSettings = () => saveInvoiceSettings(DEFAULT_INVOICE_SETTINGS);

// A new coach: nothing on their invoices yet (Prototype controls'
// "New coach, nothing added")
export const clearInvoiceSettings = () =>
  saveInvoiceSettings({ ...DEFAULT_INVOICE_SETTINGS, displayName: '', address: '', pin: '', gstRegistered: false, gstin: '', gstName: '' });

// Their GST, when they've said they're registered: { gstin, name, state },
// or null (invoices then say GST isn't charged)
export const gstOfSettings = (s) =>
  s.gstRegistered && s.gstin ? { gstin: s.gstin, name: s.gstName, state: gstStateOf(s.gstin) } : null;

// Step 2 of Payment details is done: an address and PIN are saved.
// Verify KYC unlocks then.
export const hasAddress = (s) => !addressProblem(s.address) && !pinProblem(s.pin);

// ---------- Checking what they type ----------

export const cleanPin = (text) => String(text ?? '').replace(/\D/g, '').slice(0, 6);

export function pinProblem(pin) {
  if (!pin) return 'Enter the PIN code.';
  if (!/^[1-9][0-9]{5}$/.test(pin)) return 'A PIN code has 6 digits and doesn’t start with 0.';
  return null;
}

export function displayNameProblem(name) {
  if (!String(name ?? '').trim()) return 'Enter the name to show on your invoices.';
  return null;
}

// The PAN in it is checked against their KYC later, not here
export const gstinSettingsProblem = (gstin) => gstinProblem(gstin, null);

export function gstNameProblem(name) {
  if (!String(name ?? '').trim()) return 'Enter the name your GST is registered to.';
  return null;
}

export function addressProblem(address) {
  if (!String(address ?? '').trim()) return 'Enter the address.';
  return null;
}

// '7/4, …, Chennai' + '600024' → '7/4, …, Chennai 600024'
export const addressLine = (address, pin) => [String(address ?? '').trim(), pin].filter(Boolean).join(' ');